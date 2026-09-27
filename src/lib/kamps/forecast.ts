/**
 * KAMPS predictive layer — pure TypeScript, zero dependencies, no ML libraries.
 *
 * Contents:
 *   1. poissonGammaForecast  — Bayesian Poisson(-Gamma) model with a linear trend
 *      in the log-rate. Fit by damped Newton/IRLS (deterministic), predictive
 *      distribution is a gamma-mixed Poisson (negative binomial) whose intervals
 *      come from analytic quantile inversion — no sampling, fully reproducible.
 *   2. holtWinters           — additive Holt-Winters with grid-searched
 *      hyperparameters (MAE objective) and residual-sd forecast intervals.
 *   3. buildRiskClassifier   — L2 logistic regression (gradient descent,
 *      deterministic zero init) on zone-month "elevated next month" labels.
 *   4. backtest              — walk-forward evaluation of the classifier:
 *      AUC (rank computation), Brier score, hit/false-alarm rates, lead time.
 *   5. runForecast           — top-level convenience used by the API layer.
 *
 * Everything is deterministic: fixed initialization, fixed iteration counts,
 * no random number generation anywhere in this module.
 */

// ———————————————————————————————————————————————— types ————————————————————————————————————————————————

/** One row of the county x month panel: event count for a county in a month. */
export type CountyMonth = {
  county: string;
  /** YYYY-MM */
  month: string;
  events: number;
};

export type ForecastInterval = {
  mean: number[];
  lower95: number[];
  upper95: number[];
};

export type HoltWintersOptions = {
  alpha?: number;
  beta?: number;
  gamma?: number;
  /** seasonal period in months; default 12. Ignored (gamma forced to 0) when the series is shorter than two periods. */
  seasonalPeriod?: number;
  /** number of steps to forecast forward */
  horizon: number;
};

export type HoltWintersResult = ForecastInterval & {
  fitted: number[];
  residualSd: number;
  mae: number;
  params: { alpha: number; beta: number; gamma: number; seasonalPeriod: number };
  gridSearched: boolean;
};

export type RiskClassifier = {
  /** logistic weights in standardized feature space */
  weights: number[];
  bias: number;
  /** training-set feature means / sds used to standardize inputs */
  featureMean: number[];
  featureSd: number[];
  /** event count above which the following month is labelled "elevated" (training p75) */
  elevatedThreshold: number;
  nTrain: number;
  nFeatures: number;
  /** P(elevated next month | x) */
  predict(x: number[]): number;
};

export type ClassifierFeatureRow = {
  county: string;
  /** YYYY-MM the features describe (label refers to the following month) */
  month: string;
  x: number[];
};

export type BacktestOptions = {
  /** number of leading months reserved for the first training window */
  trainMonths: number;
  /** how many months ahead the elevated label targets (1 = next month) */
  horizon: number;
};

export type BacktestResult = {
  /** rank-based AUC of accumulated (probability, label) pairs */
  auc: number;
  /** mean squared error of predicted probabilities vs 0/1 labels */
  brier: number;
  /** sensitivity: fraction of elevated months flagged at p >= 0.5 */
  hitRate: number;
  /** false positive rate: fraction of non-elevated months flagged at p >= 0.5 */
  falseAlarmRate: number;
  nPredictions: number;
  /**
   * Mean days between forecast issue (last day of the feature month, the first
   * moment the inputs exist) and the midpoint of the predicted month — i.e. the
   * average advance notice partners get while most of the risk window remains.
   */
  leadTimeDays: number;
  /** extras (documented): fixed decision threshold and label bookkeeping */
  flagThreshold: number;
  nElevated: number;
  nFlags: number;
};

export type CountyForecast = {
  county: string;
  /** YYYY-MM the forecast refers to */
  nextMonth: string;
  mean: number;
  lower95: number;
  upper95: number;
  lastEvents: number;
  recent3Mean: number;
};

export type RunForecastResult = {
  national: {
    method: "poisson-gamma-loglinear";
    horizon: number;
    lastMonth: string;
    forecastMonths: string[];
    mean: number[];
    lower95: number[];
    upper95: number[];
    /** walk-forward one-step-ahead evaluation of the same model */
    metrics: {
      mae: number;
      rmse: number;
      /** fraction of steps whose truth fell inside the 95% predictive interval */
      coverage95: number;
      nSteps: number;
    };
  };
  /** top 8 counties by predicted next-month mean */
  perCounty: CountyForecast[];
  backtest: BacktestResult;
};

// ———————————————————————————————————————— small utilities ————————————————————————————————————————

const DAY_MS = 86_400_000;

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Linear-interpolated percentile (0..1) of a sample; deterministic. */
export function percentile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const rank = q * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return s[lo];
  return s[lo] + (rank - lo) * (s[hi] - s[lo]);
}

/** Parse YYYY-MM into {y, m} with m in 1..12; returns null on malformed input. */
function parseYm(ym: string): { y: number; m: number } | null {
  const mt = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!mt) return null;
  const y = Number(mt[1]);
  const m = Number(mt[2]);
  if (m < 1 || m > 12) return null;
  return { y, m };
}

/** YYYY-MM plus k months, clamped month arithmetic. Returns null on malformed input. */
export function addMonths(ym: string, k: number): string | null {
  const p = parseYm(ym);
  if (!p) return null;
  const z = p.y * 12 + (p.m - 1) + k;
  const y = Math.floor(z / 12);
  const m = (z % 12) + 1;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
}

function ymCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0; // YYYY-MM strings sort lexicographically = chronologically
}

function stableSigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

// ————————————————————————————— 1. Poisson-Gamma log-linear forecast —————————————————————————————

/**
 * Negative-binomial predictive quantile for a gamma-mixed Poisson rate.
 *
 * The mixing gamma has shape `size` k (rate k/mean): P(Y=y) follows the NB
 * recurrence relation, so quantiles come from exact CDF accumulation — no
 * sampling, fully deterministic.
 */
function nbQuantile(m: number, size: number, q: number): number {
  if (m <= 1e-9) return 0;
  const k = Math.min(Math.max(size, 1e-9), 1e12);
  const p = k / (k + m);
  let py = Math.exp(k * Math.log(p)); // P(Y = 0)
  if (q <= py) return 0;
  let cdf = py;
  const cap = Math.ceil(m + 15 * Math.sqrt(m + 1) + 200);
  for (let y = 1; y <= cap; y++) {
    py *= ((y + k - 1) / y) * (1 - p);
    cdf += py;
    if (cdf >= q) return y;
    if (py < 1e-16 && cdf > 0.5) return y; // tail exhausted
  }
  return cap;
}

type LoglinearFit = {
  alpha: number;
  beta: number;
  /** time index of the last observation, centered */
  sLast: number;
  /** 2x2 covariance of (alpha, beta), already scaled for overdispersion */
  cov: [number, number, number]; // c00, c01, c11
  /** quasi-Poisson overdispersion (Pearson chi^2 / df, >= 1) */
  dispersion: number;
  n: number;
};

/** Penalized-MLE Poisson log-linear fit y_t ~ Poisson(exp(alpha + beta * (t - tBar))) by damped Newton. */
function fitLoglinearPoisson(y: number[]): LoglinearFit | null {
  const n = y.length;
  if (n === 0) return null;
  const tBar = (n - 1) / 2;
  const TAU2 = 100; // weak N(0, 100) prior on the slope — the ridge
  const nll = (a: number, b: number): number => {
    let v = 0;
    for (let t = 0; t < n; t++) {
      const eta = a + b * (t - tBar);
      v += Math.exp(eta) - y[t] * eta;
    }
    return v + (b * b) / (2 * TAU2);
  };

  let alpha = Math.log(mean(y) + 0.25);
  let beta = 0;
  for (let iter = 0; iter < 80; iter++) {
    let g0 = 0;
    let g1 = -beta / TAU2;
    let h00 = 0;
    let h01 = 0;
    let h11 = 1 / TAU2;
    for (let t = 0; t < n; t++) {
      const lam = Math.exp(alpha + beta * (t - tBar));
      g0 += y[t] - lam;
      g1 += (y[t] - lam) * (t - tBar);
      h00 += lam;
      h01 += lam * (t - tBar);
      h11 += lam * (t - tBar) * (t - tBar);
    }
    const det = h00 * h11 - h01 * h01;
    if (!isFinite(det) || det <= 1e-12) break;
    const d0 = (g0 * h11 - g1 * h01) / det;
    const d1 = (g1 * h00 - g0 * h01) / det;
    if (Math.abs(d0) < 1e-11 && Math.abs(d1) < 1e-11) break;
    const cur = nll(alpha, beta);
    let step = 1;
    let moved = false;
    for (let half = 0; half < 10; half++) {
      const na = alpha + step * d0;
      const nb = beta + step * d1;
      if (nll(na, nb) < cur + 1e-12) {
        alpha = na;
        beta = nb;
        moved = true;
        break;
      }
      step /= 2;
    }
    if (!moved) break;
  }
  // safety cap on the extrapolated slope (log-rate change per month)
  beta = Math.max(-0.3, Math.min(0.3, beta));

  // quasi-likelihood dispersion: Pearson chi^2 / df (>= 1), inflates intervals
  let chi2 = 0;
  let h00 = 0;
  let h01 = 0;
  let h11 = 1 / TAU2;
  for (let t = 0; t < n; t++) {
    const lam = Math.exp(alpha + beta * (t - tBar));
    if (lam > 1e-12) chi2 += ((y[t] - lam) ** 2) / lam;
    h00 += lam;
    h01 += lam * (t - tBar);
    h11 += lam * (t - tBar) * (t - tBar);
  }
  const df = Math.max(1, n - 2);
  const disp = Math.max(1, Math.min(chi2 / df, 25));
  const det = h00 * h11 - h01 * h01;
  const cov: [number, number, number] =
    det > 1e-12
      ? [(h11 / det) * disp, (-h01 / det) * disp, (h00 / det) * disp]
      : [disp, 0, disp];

  return { alpha, beta, sLast: n - 1 - tBar, cov, dispersion: disp, n };
}

/**
 * Bayesian Poisson-Gamma forecast with a linear trend in the log-rate.
 *
 * Model: y_t ~ Poisson(lambda_t), log lambda_t = alpha + beta * t.
 * Fit: damped Newton (IRLS) on the penalized likelihood (weak N(0,100) slope
 * prior); parameter covariance from the observed Fisher information, inflated
 * by a quasi-likelihood dispersion factor when residuals exceed Poisson noise.
 * Predictive: gamma-mixed Poisson (negative binomial) — k = 1/(e^v − 1) — with
 * analytic quantiles, and the trend damped (phi = 0.95) on extrapolation.
 */
export function poissonGammaForecast(series: number[], horizon: number): ForecastInterval {
  const H = Math.max(1, Math.round(horizon));
  const n = series.length;
  if (n === 0) {
    return { mean: new Array<number>(H).fill(0), lower95: new Array<number>(H).fill(0), upper95: new Array<number>(H).fill(0) };
  }

  if (n < 4) {
    // too short for a trend: conjugate Gamma(0.5, 0.5)-prior posterior predictive
    const total = series.reduce((a, b) => a + b, 0);
    const k = total + 0.5;
    const m = k / (n + 0.5);
    const meanArr: number[] = [];
    const lo: number[] = [];
    const hi: number[] = [];
    for (let h = 0; h < H; h++) {
      meanArr.push(m);
      const l = nbQuantile(m, k, 0.025);
      const u = nbQuantile(m, k, 0.975);
      lo.push(l);
      hi.push(Math.max(u, Math.ceil(m), l));
    }
    return { mean: meanArr, lower95: lo, upper95: hi };
  }

  const fit = fitLoglinearPoisson(series)!;
  const PHI = 0.95; // trend damping on extrapolation
  const meanArr: number[] = [];
  const lo: number[] = [];
  const hi: number[] = [];
  let s = fit.sLast;
  for (let h = 1; h <= H; h++) {
    s += PHI ** h; // damped extrapolation of the centered time index
    let eta = fit.alpha + fit.beta * s;
    if (eta > 20) eta = 20;
    if (eta < -20) eta = -20;
    const [c00, c01, c11] = fit.cov;
    const v = Math.max(0, c00 + 2 * c01 * s + c11 * s * s);
    const m = Math.exp(eta + v / 2); // lognormal posterior mean of the rate
    // mixing-gamma shape: quasi-Poisson observation overdispersion (disp-1)*m
    // plus lognormal parameter uncertainty m^2*(e^v - 1), i.e.
    //   Var(Y) = m + (disp-1)*m + m^2*(e^v-1)  =>  k = m / ((disp-1) + m*(e^v-1))
    const disp = fit.dispersion;
    const size = Math.max(m / (Math.max(disp - 1, 0) + m * Math.expm1(v)), 1e-9);
    const l = nbQuantile(m, size, 0.025);
    const u = nbQuantile(m, size, 0.975);
    meanArr.push(m);
    lo.push(l);
    hi.push(Math.max(u, Math.ceil(m), l));
  }
  return { mean: meanArr, lower95: lo, upper95: hi };
}

// ———————————————————————————————— 2. Additive Holt-Winters ————————————————————————————————

function runHW(
  y: number[],
  alpha: number,
  beta: number,
  gamma: number,
  p: number
): { fitted: number[]; resid: number[]; level: number; trend: number; s: number[] } {
  const n = y.length;
  const seasonal = p >= 2 && n >= 2 * p;
  // initialization
  let level: number;
  let trend: number;
  const s: number[] = new Array<number>(Math.max(p, 1)).fill(0);
  if (seasonal) {
    const nCycles = Math.floor(n / p);
    level = mean(y.slice(0, p));
    trend = nCycles >= 2 ? (mean(y.slice(p, 2 * p)) - mean(y.slice(0, p))) / p : 0;
    for (let i = 0; i < p; i++) {
      const devs: number[] = [];
      for (let c = 0; c < nCycles; c++) {
        const idx = c * p + i;
        if (idx < n) {
          const cStart = c * p;
          const cEnd = Math.min(cStart + p, n);
          devs.push(y[idx] - mean(y.slice(cStart, cEnd)));
        }
      }
      s[i] = mean(devs);
    }
    const sMean = mean(s);
    for (let i = 0; i < p; i++) s[i] -= sMean;
  } else {
    level = mean(y);
    trend = n >= 2 ? (y[n - 1] - y[0]) / (n - 1) : 0;
    gamma = 0;
  }

  const fitted: number[] = [];
  const resid: number[] = [];
  for (let t = 0; t < n; t++) {
    const f = seasonal ? level + trend + s[t % p] : level + trend;
    fitted.push(f);
    resid.push(y[t] - f);
    if (t < p) continue; // warm-up: parameters already estimated from this span
    const lvlPrev = level;
    const levelNew = seasonal
      ? alpha * (y[t] - s[t % p]) + (1 - alpha) * (level + trend)
      : alpha * y[t] + (1 - alpha) * (level + trend);
    const trendNew = beta * (levelNew - lvlPrev) + (1 - beta) * trend;
    if (seasonal) s[t % p] = gamma * (y[t] - levelNew) + (1 - gamma) * s[t % p];
    level = levelNew;
    trend = trendNew;
  }
  return { fitted, resid, level, trend, s };
}

/**
 * Additive Holt-Winters with grid-searched hyperparameters.
 *
 * Any of alpha/beta/gamma left undefined is grid-searched (MAE objective on
 * one-step-ahead in-sample errors after the seasonal warm-up). Forecast
 * intervals are point ± 1.96 * residualSd * sqrt(h), lower-clamped at 0.
 */
export function holtWinters(series: number[], opts: HoltWintersOptions): HoltWintersResult {
  const y = series;
  const n = y.length;
  const H = Math.max(1, Math.round(opts.horizon));
  const p = opts.seasonalPeriod === undefined ? 12 : Math.max(1, Math.round(opts.seasonalPeriod));
  const seasonal = p >= 2 && n >= 2 * p;

  const inRange = (v: number | undefined, lo: number, hi: number) =>
    v === undefined ? false : v >= lo && v <= hi;

  const fixedAlpha = inRange(opts.alpha, 0.01, 0.99) ? (opts.alpha as number) : undefined;
  const fixedBeta = inRange(opts.beta, 0, 0.99) ? (opts.beta as number) : undefined;
  const fixedGamma = seasonal ? (inRange(opts.gamma, 0, 0.99) ? (opts.gamma as number) : undefined) : 0;

  let best = { alpha: fixedAlpha ?? 0.3, beta: fixedBeta ?? 0.1, gamma: fixedGamma ?? 0.1, mae: Infinity };
  let gridSearched = false;
  if (fixedAlpha === undefined || fixedBeta === undefined || (seasonal && fixedGamma === undefined)) {
    gridSearched = true;
    const alphas = fixedAlpha === undefined ? [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75] : [fixedAlpha];
    const betas = fixedBeta === undefined ? [0, 0.05, 0.1, 0.15, 0.2, 0.3] : [fixedBeta];
    const gammas =
      fixedGamma === undefined && seasonal
        ? [0, 0.05, 0.1, 0.15, 0.2, 0.3]
        : [fixedGamma === undefined ? 0 : fixedGamma];
    for (const a of alphas) {
      for (const b of betas) {
        for (const g of gammas) {
          if (!seasonal && g > 0) continue;
          const r = runHW(y, a, b, g, p);
          const errs = r.resid.slice(p);
          if (errs.length === 0) continue;
          const mae = mean(errs.map(Math.abs));
          if (mae < best.mae - 1e-12) best = { alpha: a, beta: b, gamma: seasonal ? g : 0, mae };
        }
      }
    }
  } else {
    const gammaFixed = fixedGamma ?? 0;
    const r = runHW(y, fixedAlpha, fixedBeta, gammaFixed, p);
    const errs = r.resid.slice(p);
    best = { alpha: fixedAlpha, beta: fixedBeta, gamma: gammaFixed, mae: errs.length ? mean(errs.map(Math.abs)) : 0 };
  }

  const finalRun = runHW(y, best.alpha, best.beta, best.gamma, p);
  const errs = finalRun.resid.slice(p);
  const residSd = errs.length > 1 ? Math.sqrt(mean(errs.map((e) => e * e))) : 0;

  const meanOut: number[] = [];
  const lo: number[] = [];
  const hi: number[] = [];
  for (let h = 1; h <= H; h++) {
    const point = seasonal
      ? finalRun.level + h * finalRun.trend + finalRun.s[(n - 1 + h) % p]
      : finalRun.level + h * finalRun.trend;
    const m = Math.max(0, point);
    const width = 1.96 * residSd * Math.sqrt(h);
    meanOut.push(m);
    lo.push(Math.max(0, m - width));
    hi.push(m + width);
  }

  return {
    mean: meanOut,
    lower95: lo,
    upper95: hi,
    fitted: finalRun.fitted,
    residualSd: residSd,
    mae: best.mae === Infinity ? 0 : best.mae,
    params: { alpha: best.alpha, beta: best.beta, gamma: best.gamma, seasonalPeriod: seasonal ? p : 1 },
    gridSearched,
  };
}

// ———————————————————————————— 3. Logistic risk classifier ————————————————————————————

type LogisticModel = {
  weights: number[];
  bias: number;
  featureMean: number[];
  featureSd: number[];
};

/** Full-batch gradient descent: zero init, lr 0.1, 500 epochs, L2 lambda 0.01 (bias unpenalized). */
function trainLogistic(rows: { x: number[]; y: number }[]): LogisticModel {
  const nFeat = rows.length ? rows[0].x.length : 0;
  const featureMean = new Array<number>(nFeat).fill(0);
  const featureSd = new Array<number>(nFeat).fill(1);
  for (let j = 0; j < nFeat; j++) {
    const col = rows.map((r) => r.x[j]);
    featureMean[j] = mean(col);
    const v = mean(col.map((c) => (c - featureMean[j]) ** 2));
    featureSd[j] = Math.max(Math.sqrt(v), 1e-6);
  }
  const z = rows.map((r) => r.x.map((v, j) => (v - featureMean[j]) / featureSd[j]));
  const weights = new Array<number>(nFeat).fill(0);
  let bias = 0;
  const LR = 0.1;
  const LAMBDA = 0.01;
  const EPOCHS = 500;
  const n = rows.length;
  if (n === 0) return { weights, bias, featureMean, featureSd };
  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    const gw = new Array<number>(nFeat).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      let dot = bias;
      for (let j = 0; j < nFeat; j++) dot += weights[j] * z[i][j];
      const err = stableSigmoid(dot) - rows[i].y;
      for (let j = 0; j < nFeat; j++) gw[j] += (err * z[i][j]) / n;
      gb += err / n;
    }
    for (let j = 0; j < nFeat; j++) weights[j] -= LR * (gw[j] + LAMBDA * weights[j]);
    bias -= LR * gb;
  }
  return { weights, bias, featureMean, featureSd };
}

function logisticPredict(model: LogisticModel, x: number[]): number {
  if (model.weights.length === 0 || x.length !== model.weights.length) return 0.5;
  let dot = model.bias;
  for (let j = 0; j < model.weights.length; j++) {
    dot += model.weights[j] * ((x[j] - model.featureMean[j]) / model.featureSd[j]);
  }
  return stableSigmoid(dot);
}

/**
 * Train a logistic-regression risk classifier on zone-month rows.
 *
 * Label: events in the month AFTER the feature month exceed the 75th
 * percentile of all such next-month event counts. Training is full-batch
 * gradient descent with L2 (zero init, lr 0.1, 500 epochs, lambda 0.01) —
 * fully deterministic.
 */
export function buildRiskClassifier(
  panels: CountyMonth[],
  features: ClassifierFeatureRow[]
): RiskClassifier {
  const lookup = new Map<string, number>();
  for (const p of panels) lookup.set(`${p.county}\u0000${p.month}`, p.events);

  const rows: { x: number[]; y: number }[] = [];
  const targets: number[] = [];
  const labeled: { x: number[]; nextEvents: number }[] = [];
  for (const f of features) {
    const nm = addMonths(f.month, 1);
    if (!nm) continue;
    const nextEvents = lookup.get(`${f.county}\u0000${nm}`);
    if (nextEvents === undefined) continue;
    labeled.push({ x: f.x, nextEvents });
    targets.push(nextEvents);
  }
  const threshold = percentile(targets, 0.75);
  for (const l of labeled) rows.push({ x: l.x, y: l.nextEvents > threshold ? 1 : 0 });

  const model = trainLogistic(rows);
  return {
    weights: model.weights,
    bias: model.bias,
    featureMean: model.featureMean,
    featureSd: model.featureSd,
    elevatedThreshold: threshold,
    nTrain: rows.length,
    nFeatures: model.weights.length,
    predict: (x: number[]) => logisticPredict(model, x),
  };
}

// ———————————————————————————————— 4. Walk-forward backtest ————————————————————————————————

/**
 * Rank-based AUC (Mann-Whitney statistic) with tie-corrected average ranks.
 */
export function aucRank(scores: number[], labels: number[]): number {
  const n = scores.length;
  if (n === 0) return 0.5;
  const order = scores.map((s, i) => [s, i] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const ranks = new Array<number>(n).fill(0);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && order[j + 1][0] === order[i][0]) j++;
    const avgRank = (i + j + 2) / 2; // 1-based positions i+1 .. j+1
    for (let k = i; k <= j; k++) ranks[order[k][1]] = avgRank;
    i = j + 1;
  }
  let sumPos = 0;
  let nPos = 0;
  for (let k = 0; k < n; k++) {
    if (labels[k] === 1) {
      sumPos += ranks[k];
      nPos++;
    }
  }
  const nNeg = n - nPos;
  if (nPos === 0 || nNeg === 0) return 0.5;
  return (sumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

type PanelGrid = {
  months: string[];
  counties: string[];
  /** events[countyIndex][monthIndex], 0 when the county has no record that month */
  events: number[][];
  /** whether the county actually reported that month */
  present: boolean[][];
};

function buildGrid(panels: CountyMonth[]): PanelGrid | null {
  const monthSet = new Set<string>();
  const countySet = new Set<string>();
  for (const p of panels) {
    if (!parseYm(p.month)) continue;
    monthSet.add(p.month);
    countySet.add(p.county);
  }
  if (monthSet.size === 0 || countySet.size === 0) return null;
  const months = [...monthSet].sort(ymCompare);
  const counties = [...countySet].sort();
  const mIdx = new Map(months.map((m, i) => [m, i]));
  const events: number[][] = counties.map(() => months.map(() => 0));
  const present: boolean[][] = counties.map(() => months.map(() => false));
  for (const p of panels) {
    const mi = mIdx.get(p.month);
    if (mi === undefined) continue;
    const ci = counties.indexOf(p.county);
    if (ci < 0) continue;
    events[ci][mi] += p.events;
    present[ci][mi] = true;
  }
  return { months, counties, events, present };
}

/**
 * Feature vector describing a county's history through month index i
 * (inclusive). Uses only data at or before month i.
 */
function featureAt(events: number[], i: number, month: string): number[] {
  const cur = events[i];
  const lag1 = i >= 1 ? events[i - 1] : cur;
  const win = (from: number, to: number): number => {
    const a = Math.max(0, from);
    if (to < a) return 0;
    let s = 0;
    let c = 0;
    for (let k = a; k <= to; k++) {
      s += events[k];
      c++;
    }
    return c ? s / c : 0;
  };
  const mean3 = win(i - 2, i);
  const mean6 = win(i - 5, i);
  const prev3 = win(i - 5, i - 3);
  const p = parseYm(month);
  const mOfYear = p ? p.m : 1;
  const ang = (2 * Math.PI * mOfYear) / 12;
  return [cur, lag1, mean3, mean6, mean3 - prev3, Math.sin(ang), Math.cos(ang)];
}

/**
 * Walk-forward backtest of the elevated-month classifier.
 *
 * For each test month t (0-based month index >= trainMonths): train a logistic
 * model on all feature rows whose target month (t + horizon) has already been
 * observed, where "elevated" is defined by the 75th percentile of the TRAINING
 * targets (no future information enters labels or features), then predict
 * P(elevated) for every county for the target month. Accumulate probability /
 * label pairs across folds and compute metrics.
 */
export function backtest(panels: CountyMonth[], opts: BacktestOptions): BacktestResult {
  const grid = buildGrid(panels);
  const empty: BacktestResult = {
    auc: 0.5,
    brier: 0.5,
    hitRate: 0,
    falseAlarmRate: 0,
    nPredictions: 0,
    leadTimeDays: 0,
    flagThreshold: 0.5,
    nElevated: 0,
    nFlags: 0,
  };
  if (!grid) return empty;

  const { months, counties, events, present } = grid;
  const H = Math.max(1, Math.round(opts.horizon));
  const trainMonths = Math.max(2, Math.round(opts.trainMonths));

  // precompute all feature rows (each row depends only on history through its month)
  type Row = { county: string; month: string; mi: number; ci: number; x: number[]; target: number | null };
  const rows: Row[] = [];
  for (let ci = 0; ci < counties.length; ci++) {
    for (let mi = 0; mi < months.length; mi++) {
      if (!present[ci][mi]) continue;
      const targetMi = mi + H;
      const target =
        targetMi < months.length && present[ci][targetMi] ? events[ci][targetMi] : null;
      rows.push({
        county: counties[ci],
        month: months[mi],
        mi,
        ci,
        x: featureAt(events[ci], mi, months[mi]),
        target,
      });
    }
  }

  const scores: number[] = [];
  const labels: number[] = [];
  const tpLeadDays: number[] = [];
  const FLAG = 0.5;

  for (let ti = trainMonths; ti < months.length - 1; ti++) {
    const trainRows = rows.filter((r) => r.mi <= ti - H && r.target !== null);
    if (trainRows.length < 12) continue;
    const targets = trainRows.map((r) => r.target as number);
    const foldThreshold = percentile(targets, 0.75);
    const train = trainRows.map((r) => ({ x: r.x, y: (r.target as number) > foldThreshold ? 1 : 0 }));
    const model = trainLogistic(train);

    const testRows = rows.filter((r) => r.mi === ti && r.target !== null);
    for (const r of testRows) {
      const p = logisticPredict(model, r.x);
      const y = (r.target as number) > foldThreshold ? 1 : 0;
      scores.push(p);
      labels.push(y);
      if (p >= FLAG && y === 1) {
        // lead time: last day of feature month -> 15th of target month
        const targetMonth = months[r.mi + H];
        const tp = parseYm(r.month);
        const tm = parseYm(targetMonth);
        if (tp && tm) {
          const issue = Date.UTC(tp.y, tp.m, 0); // day 0 of next month = last day of tp
          const mid = Date.UTC(tm.y, tm.m - 1, 15);
          tpLeadDays.push((mid - issue) / DAY_MS);
        }
      }
    }
  }

  const n = scores.length;
  if (n === 0) return empty;
  let tp = 0;
  let fn = 0;
  let fp = 0;
  let tn = 0;
  for (let k = 0; k < n; k++) {
    const flagged = scores[k] >= FLAG;
    if (labels[k] === 1) {
      if (flagged) tp++;
      else fn++;
    } else {
      if (flagged) fp++;
      else tn++;
    }
  }
  return {
    auc: aucRank(scores, labels),
    brier: mean(scores.map((p, k) => (p - labels[k]) ** 2)),
    hitRate: tp + fn > 0 ? tp / (tp + fn) : 0,
    falseAlarmRate: fp + tn > 0 ? fp / (fp + tn) : 0,
    nPredictions: n,
    leadTimeDays: tpLeadDays.length ? Math.round(mean(tpLeadDays) * 10) / 10 : 0,
    flagThreshold: FLAG,
    nElevated: tp + fn,
    nFlags: tp + fp,
  };
}

// ———————————————————————————————— 5. Top-level convenience ————————————————————————————————

/** Walk-forward one-step-ahead evaluation of poissonGammaForecast on a series. */
function oneStepWalkForward(series: number[], minTrain = 12): { mae: number; rmse: number; coverage95: number; nSteps: number } {
  const errs: number[] = [];
  let covered = 0;
  let steps = 0;
  for (let t = minTrain; t < series.length; t++) {
    const hist = series.slice(0, t);
    const f = poissonGammaForecast(hist, 1);
    const truth = series[t];
    errs.push(Math.abs(f.mean[0] - truth));
    if (truth >= f.lower95[0] && truth <= f.upper95[0]) covered++;
    steps++;
  }
  if (steps === 0) return { mae: 0, rmse: 0, coverage95: 0, nSteps: 0 };
  return {
    mae: mean(errs),
    rmse: Math.sqrt(mean(errs.map((e) => e * e))),
    coverage95: covered / steps,
    nSteps: steps,
  };
}

/**
 * Full KAMPS forecast over a county x month panel:
 *   - national Poisson-Gamma log-linear forecast (3-month horizon) with
 *     walk-forward one-step metrics (MAE, RMSE, 95% interval coverage);
 *   - top-8 counties by predicted next-month mean, with 95% intervals;
 *   - walk-forward backtest of the elevated-month risk classifier.
 */
export function runForecast(panels: CountyMonth[]): RunForecastResult {
  const grid = buildGrid(panels);
  if (!grid) {
    return {
      national: {
        method: "poisson-gamma-loglinear",
        horizon: 3,
        lastMonth: "-",
        forecastMonths: [],
        mean: [],
        lower95: [],
        upper95: [],
        metrics: { mae: 0, rmse: 0, coverage95: 0, nSteps: 0 },
      },
      perCounty: [],
      backtest: backtest(panels, { trainMonths: 12, horizon: 1 }),
    };
  }

  const { months, counties, events, present } = grid;
  const nationalSeries = months.map((_, mi) => events.reduce((s, col) => s + col[mi], 0));
  const lastMonth = months[months.length - 1];

  const HORIZON = 3;
  const nf = poissonGammaForecast(nationalSeries, HORIZON);
  const forecastMonths: string[] = [];
  for (let h = 1; h <= HORIZON; h++) {
    const nm = addMonths(lastMonth, h);
    forecastMonths.push(nm ?? "-");
  }
  const metrics = oneStepWalkForward(nationalSeries, Math.min(12, Math.max(4, Math.floor(months.length / 3))));

  const perCounty: CountyForecast[] = [];
  const nextMonth = addMonths(lastMonth, 1) ?? "-";
  for (let ci = 0; ci < counties.length; ci++) {
    const observed = months.filter((_, mi) => present[ci][mi]).length;
    if (observed < 6) continue;
    const f = poissonGammaForecast(events[ci], 1);
    const lastMi = months.length - 1;
    const recent3 = events[ci].slice(Math.max(0, lastMi - 2), lastMi + 1);
    perCounty.push({
      county: counties[ci],
      nextMonth,
      mean: f.mean[0],
      lower95: f.lower95[0],
      upper95: f.upper95[0],
      lastEvents: events[ci][lastMi],
      recent3Mean: Math.round(mean(recent3) * 100) / 100,
    });
  }
  perCounty.sort((a, b) => b.mean - a.mean || a.county.localeCompare(b.county));

  return {
    national: {
      method: "poisson-gamma-loglinear",
      horizon: HORIZON,
      lastMonth,
      forecastMonths,
      mean: nf.mean.map((v) => Math.round(v * 100) / 100),
      lower95: nf.lower95,
      upper95: nf.upper95,
      metrics: {
        mae: Math.round(metrics.mae * 100) / 100,
        rmse: Math.round(metrics.rmse * 100) / 100,
        coverage95: Math.round(metrics.coverage95 * 1000) / 1000,
        nSteps: metrics.nSteps,
      },
    },
    perCounty: perCounty.slice(0, 8),
    backtest: backtest(panels, { trainMonths: 12, horizon: 1 }),
  };
}
