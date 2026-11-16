// Ben's addition: per-measure time signatures.
//
// A groove keeps one "base" time signature (e.g. 4/4). Each measure can be
// shorter: measureBeats[m] is the number of beats (time-signature numerators)
// that measure m actually uses, e.g. [4, 3] for a 4/4 bar followed by a 3/4 bar.
// The note lanes stay full-size (every measure has room for the base meter);
// the slots past a measure's length are simply ignored when rendering/playing.
//
// URL form: &MeasureBeats=4,3   (only written when some measure differs)

/**
 * Parse "4,3,4" into [4,3,4], validated against the groove. Returns null when
 * absent, malformed, or when every measure uses the full base meter.
 * @param {string|false} str
 * @param {number} numberOfMeasures
 * @param {number} numBeats
 * @returns {number[]|null}
 */
export function parseMeasureBeats(str, numberOfMeasures, numBeats) {
  if (!str) return null;
  var parts = String(str)
    .split(/[,|]/)
    .map((x) => parseInt(x, 10));
  var out = [];
  for (var m = 0; m < numberOfMeasures; m++) {
    var v = parts[m];
    if (!(v >= 1 && v <= numBeats)) v = numBeats;
    out.push(v);
  }
  return out.some((v) => v != numBeats) ? out : null;
}

/** "4,3,4" or '' when not needed. */
export function measureBeatsToString(measureBeats, numBeats) {
  if (!measureBeats || !measureBeats.some((v) => v != numBeats)) return '';
  return measureBeats.join(',');
}

/** Beats used by measure m (falls back to the base meter). */
export function beatsForMeasure(measureBeats, m, numBeats) {
  if (!measureBeats) return numBeats;
  var v = measureBeats[m];
  return v >= 1 && v <= numBeats ? v : numBeats;
}

/** Number of slots of a measure that are actually used. */
export function usedSlots(slotsPerMeasure, beats, numBeats) {
  return Math.round((slotsPerMeasure * beats) / numBeats);
}

/** Insert an inline meter change at the start of every voice of an ABC chunk. */
export function addInlineMeter(abc, top, bottom) {
  return abc.replace(/(V:[^\n]*\n(?:%%voicemap drum\n)?)/g, '$1[M:' + top + '/' + bottom + ']');
}
