// Ben's addition: a time signature per measure (mixed meters).
//
// A groove keeps one "base" time signature (numBeats/noteValue). When measures
// use different meters, the base is the longest measure (in quarter notes,
// rounded up, over 4) and every measure gets its own [top, bottom]. The note
// lanes stay full-size per base measure; slots past a measure's own length are
// ignored for notation and playback.
//
// URL form: &Meters=4/4,7/8,3/4   (only written when measures differ)
// Legacy:   &MeasureBeats=4,3     (numerators over the base bottom)

/** @typedef {[number, number]} Meter */

function parseMeter(txt, baseBottom) {
  var parts = String(txt).split('/');
  var top = parseInt(parts[0], 10);
  var bottom = parts.length > 1 ? parseInt(parts[1], 10) : baseBottom;
  if (!(top >= 1 && top <= 32) || [1, 2, 4, 8, 16, 32].indexOf(bottom) < 0) return null;
  return [top, bottom];
}

/** Length of a meter relative to the base meter (1 = a full base measure). */
export function barFraction(meter, baseTop, baseBottom) {
  return meter[0] / meter[1] / (baseTop / baseBottom);
}

/**
 * @returns {Meter[]|null}  one meter per measure, or null when every measure uses the base
 */
export function parseMeters(metersStr, legacyStr, numberOfMeasures, baseTop, baseBottom) {
  var src = metersStr || legacyStr;
  if (!src) return null;
  var parts = String(src).split(/[,|]/);
  var out = [];
  var mixed = false;
  for (var m = 0; m < numberOfMeasures; m++) {
    var meter = parts[m] !== undefined ? parseMeter(parts[m], baseBottom) : null;
    if (!meter || barFraction(meter, baseTop, baseBottom) > 1.0000001) meter = [baseTop, baseBottom];
    if (meter[0] != baseTop || meter[1] != baseBottom) mixed = true;
    out.push(meter);
  }
  return mixed ? out : null;
}

export function metersToString(meters, baseTop, baseBottom) {
  if (!meters || !meters.some((mt) => mt[0] != baseTop || mt[1] != baseBottom)) return '';
  return meters.map((mt) => mt[0] + '/' + mt[1]).join(',');
}

/** Meter of measure m (falls back to the base meter). */
export function meterFor(meters, m, baseTop, baseBottom) {
  var mt = meters && meters[m];
  return mt ? [mt[0], mt[1]] : [baseTop, baseBottom];
}

/** Number of slots of a measure that are actually used. */
export function usedSlots(slotsPerMeasure, meter, baseTop, baseBottom) {
  return Math.round(slotsPerMeasure * barFraction(meter, baseTop, baseBottom));
}

/**
 * Base meter for a list of measure meters: the meter itself when they are all
 * equal, otherwise the longest measure rounded up to whole quarter notes, over 4.
 * @param {Meter[]} meters
 * @returns {Meter}
 */
export function chooseBaseMeter(meters) {
  var first = meters[0];
  if (meters.every((mt) => mt[0] == first[0] && mt[1] == first[1])) return [first[0], first[1]];
  var maxQuarters = 0;
  meters.forEach((mt) => {
    maxQuarters = Math.max(maxQuarters, (mt[0] * 4) / mt[1]);
  });
  return [Math.max(1, Math.ceil(maxQuarters - 1e-9)), 4];
}

/** Insert an inline meter change at the start of every voice of an ABC chunk. */
export function addInlineMeter(abc, top, bottom) {
  return abc.replace(/(V:[^\n]*\n(?:%%voicemap drum\n)?)/g, '$1[M:' + top + '/' + bottom + ']');
}
