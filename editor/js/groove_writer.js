// Javascript for the Groove Scribe HTML application
// Groove Scribe is for drummers and helps create sheet music with an easy to use WYSIWYG groove editor.
//
// Author: Lou Montulli
// Original Creation date: Feb 2015.
//
//  Copyright 2015-2020 Lou Montulli, Mike Johnston
//
//  This file is part of Project Groove Scribe.
//
//  Groove Scribe is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 2 of the License, or
//  (at your option) any later version.
//
//  Groove Scribe is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with Groove Scribe.  If not, see <http://www.gnu.org/licenses/>.

// GrooveUtils and the drum-notation / MIDI constants come from groove_utils.js.
// Vendored libraries (Midi, MIDI, Pablo, ShareButton) remain window globals
// provided by the classic <script> tags loaded before this module.
import { addInlineMeter, barFraction, chooseBaseMeter } from './meters.js?v=1795007786';
import { GrooveUtils } from './groove_utils.js?v=1795007786';
import {
  constant_ABC_HH_Accent,
  constant_ABC_HH_Close,
  constant_ABC_HH_Cow_Bell,
  constant_ABC_HH_Crash,
  constant_ABC_HH_Metronome_Accent,
  constant_ABC_HH_Metronome_Normal,
  constant_ABC_HH_Normal,
  constant_ABC_HH_Open,
  constant_ABC_HH_Ride,
  constant_ABC_HH_Ride_Bell,
  constant_ABC_HH_Stacker,
  constant_ABC_KI_Normal,
  constant_ABC_KI_SandK,
  constant_ABC_KI_Splash,
  constant_ABC_SN_Accent,
  constant_ABC_SN_Buzz,
  constant_ABC_SN_Drag,
  constant_ABC_SN_Flam,
  constant_ABC_SN_Ghost,
  constant_ABC_SN_Normal,
  constant_ABC_SN_XStick,
  constant_ABC_STICK_BOTH,
  constant_ABC_STICK_COUNT,
  constant_ABC_STICK_L,
  constant_ABC_STICK_OFF,
  constant_ABC_STICK_R,
  constant_ABC_T1_Normal,
  constant_ABC_T2_Normal,
  constant_ABC_T3_Normal,
  constant_ABC_T4_Normal,
  constant_OUR_MIDI_HIHAT_ACCENT,
  constant_OUR_MIDI_HIHAT_COW_BELL,
  constant_OUR_MIDI_HIHAT_CRASH,
  constant_OUR_MIDI_HIHAT_FOOT,
  constant_OUR_MIDI_HIHAT_METRONOME_ACCENT,
  constant_OUR_MIDI_HIHAT_METRONOME_NORMAL,
  constant_OUR_MIDI_HIHAT_NORMAL,
  constant_OUR_MIDI_HIHAT_OPEN,
  constant_OUR_MIDI_HIHAT_RIDE,
  constant_OUR_MIDI_HIHAT_RIDE_BELL,
  constant_OUR_MIDI_HIHAT_STACKER,
  constant_OUR_MIDI_KICK_NORMAL,
  constant_OUR_MIDI_SNARE_ACCENT,
  constant_OUR_MIDI_SNARE_BUZZ,
  constant_OUR_MIDI_SNARE_DRAG,
  constant_OUR_MIDI_SNARE_FLAM,
  constant_OUR_MIDI_SNARE_GHOST,
  constant_OUR_MIDI_SNARE_NORMAL,
  constant_OUR_MIDI_SNARE_XSTICK,
  constant_OUR_MIDI_TOM1_NORMAL,
  constant_OUR_MIDI_TOM2_NORMAL,
  constant_OUR_MIDI_TOM3_NORMAL,
  constant_OUR_MIDI_TOM4_NORMAL,
  constant_OUR_MIDI_VELOCITY_NORMAL,
  constant_sticking_right_on_color_rgb,
  constant_sticking_left_on_color_rgb,
  constant_sticking_both_on_color_rgb,
  constant_sticking_count_on_color_rgb,
} from './constants.js?v=1795007786';
import * as _perm from './permutations.js?v=1795007786';
import * as _view from './viewHtml.js?v=1795007786';
import * as _grid from './gridState.js?v=1795007786';

// GrooveWriter class.   The only one in this file.

function GrooveWriter() {
  'use strict';

  var root = this;

  root.myGrooveUtils = new GrooveUtils();

  var class_undo_stack = [];
  var class_redo_stack = [];
  var constant_undo_stack_max_size = 40;

  // public class vars
  var class_number_of_measures = 1;
  // Ben: per-measure beats (mixed meters) and per-beat grid resolution in the editor
  var class_measure_meters = []; // [top, bottom] per measure; missing = base meter
  var class_beat_res = {}; // "measure-beat" -> grid level id ('4','8','16','32','8t','16t')
  var class_play_from = null; // bar index to start playback from (null = start)
  var class_loop_bars = {}; // bar index -> true: only these bars are played (looped)
  var class_play_timeline = []; // [{bar, slots}] of the MIDI that is playing
  var class_bar_map_start = []; // per bar: start index in note_mapping_array
  var class_bar_stash = {}; // bar index -> notes cut off by a shorter time signature (restored when it grows again)
  var class_time_division = parseInt(root.myGrooveUtils.getQueryVariableFromURL('Div', '16'), 10); // default to 16ths
  var class_num_beats_per_measure = 4; // TimeSigTop
  var class_note_value_per_measure = 4; // TimeSigBottom
  var class_notes_per_measure = root.myGrooveUtils.calc_notes_per_measure(
    class_time_division,
    class_num_beats_per_measure,
    class_note_value_per_measure
  );
  var class_metronome_auto_speed_up_active = false;
  var class_metronome_count_in_active = false;
  var class_metronome_count_in_is_playing = false;

  // set debugMode immediately so we can use it in index.html
  root.myGrooveUtils.debugMode = parseInt(
    root.myGrooveUtils.getQueryVariableFromURL('Debug', '0'),
    10
  );
  root.myGrooveUtils.grooveDBAuthoring = parseInt(
    root.myGrooveUtils.getQueryVariableFromURL('GDB_Author', '0'),
    10
  );

  // private vars in the scope of the class
  var class_app_title = 'Drumsheet: free online drum notation editor';
  var class_permutation_type = 'none';
  var class_advancedEditIsOn = false;
  var class_measure_for_note_label_click = 0;
  var class_which_index_last_clicked = 0; // which note was last clicked for the context menu

  // local constants (UI colors used only by the note setters; the shared "on"
  // colors the gridState readers also compare against now live in constants.js)
  var constant_note_on_color_hex = '#000000'; // black
  var constant_note_off_color_hex = '#FFF';
  var constant_note_border_color_hex = '#999';
  var constant_hihat_note_off_color_hex = '#CCC';
  var constant_note_hidden_color_rgb = 'transparent';
  var constant_sticking_right_off_color_rgb = 'rgb(204, 204, 204)';
  var constant_sticking_left_off_color_rgb = 'rgb(204, 204, 204)';
  var constant_snare_accent_on_color_hex = '#FFF';

  // functions below

  root.numberOfMeasures = function () {
    return class_number_of_measures;
  };

  root.notesPerMeasure = function () {
    return class_notes_per_measure;
  };

  // is the division a triplet groove?   12, 24, or 48 notes
  function usingTriplets() {
    if (root.myGrooveUtils.isTripletDivision(class_time_division)) return true;

    return false;
  }

  function addOrRemoveKeywordFromClass(tag_class, keyword, addElseRemove) {
    var return_val = true;

    if (tag_class) {
      if (tag_class.className != undefined) {
        if (addElseRemove) {
          if (tag_class.className.indexOf(keyword) < 0) {
            tag_class.className += ' ' + keyword;
          }
        } else {
          tag_class.className = tag_class.className.replace(' ' + keyword, '');
        }
      } else {
        console.log(
          'Warning in addOrRemoveKeywordFromClassName: null className for tag id: ' + tag_class.id
        );
        console.trace();
        return_val = false;
      }
    } else {
      console.log('Warning in addOrRemoveKeywordFromClassName: null tag_class passed in');
      return_val = false;
    }

    return return_val;
  }

  function addOrRemoveKeywordFromClassById(tagId, keyword, addElseRemove) {
    var tag_class = document.getElementById(tagId);

    if (!addOrRemoveKeywordFromClass(tag_class, keyword, addElseRemove))
      console.log('Warning in addOrRemoveKeywordFromClassById bad ID: ' + tagId);
  }

  function selectButton(element) {
    // highlight the new div by adding selected css class
    addOrRemoveKeywordFromClass(element, 'buttonSelected', true);
  }

  function unselectButton(element) {
    // remove selected class if it exists
    addOrRemoveKeywordFromClass(element, 'buttonSelected', false);
  }

  // --- Clickable-grid note state (extracted to gridState.js) -----------------
  // Thin wrappers preserving the in-file API; delegate to the pure DOM readers.
  function is_snare_on(id) {
    return _grid.is_snare_on(id);
  }
  function get_snare_state(id, returnType) {
    return _grid.get_snare_state(id, returnType);
  }
  function is_tom_on(id, tom_num) {
    return _grid.is_tom_on(id, tom_num);
  }
  function get_tom_state(id, tom_num, returnType) {
    return _grid.get_tom_state(id, tom_num, returnType);
  }
  function is_kick_on(id) {
    return _grid.is_kick_on(id);
  }
  function get_kick_state(id, returnType) {
    return _grid.get_kick_state(id, returnType);
  }
  function is_hh_on(id) {
    return _grid.is_hh_on(id);
  }
  function get_hh_state(id, returnType) {
    return _grid.get_hh_state(id, returnType);
  }
  function get_sticking_state(id, returnType) {
    return _grid.get_sticking_state(id, returnType);
  }

  function play_single_note_for_note_setting(note_val) {
    if (MIDI.WebAudio) {
      MIDI.WebAudio.noteOn(9, note_val, constant_OUR_MIDI_VELOCITY_NORMAL, 0);
    } else if (MIDI.AudioTag) {
      MIDI.AudioTag.noteOn(9, note_val, constant_OUR_MIDI_VELOCITY_NORMAL, 0);
    }
  }

  // returns the ABC notation for the snare state
  // false = off
  //
  //  c == Snare Normal</li>
  //  !accent!c == Snare Accent</li>
  //  _c == Ghost Note    shows an x with a circle around it.   Needs improvement
  //  ^c == xstick   shows an x

  // returns the ABC notation for the Tom state
  // false = off
  // "x" = normal tom

  // set the tom note on with type
  function set_tom_state(id, tom_num, mode, make_sound) {
    // turn stuff on conditionally
    switch (mode) {
      case 'off':
        document.getElementById('tom_circle' + tom_num + '-' + id).style.backgroundColor =
          constant_note_off_color_hex;
        document.getElementById('tom_circle' + tom_num + '-' + id).style.borderColor =
          constant_note_border_color_hex;
        break;
      case 'normal':
        document.getElementById('tom_circle' + tom_num + '-' + id).style.backgroundColor =
          constant_note_on_color_hex;
        document.getElementById('tom_circle' + tom_num + '-' + id).style.borderColor =
          constant_note_border_color_hex;
        if (make_sound)
          switch (tom_num) {
            case 1:
              play_single_note_for_note_setting(constant_OUR_MIDI_TOM1_NORMAL);
              break;
            case 2:
              play_single_note_for_note_setting(constant_OUR_MIDI_TOM2_NORMAL);
              break;
            case 3:
              play_single_note_for_note_setting(constant_OUR_MIDI_TOM3_NORMAL);
              break;
            case 4:
              play_single_note_for_note_setting(constant_OUR_MIDI_TOM4_NORMAL);
              break;
            default:
              console.log('bad switch in set_tom_state. bad tom num:' + tom_num);
              break;
          }
        break;
      default:
        console.log('bad switch in set_tom_state');
        break;
    }
  }

  // silly helpers, but needed for argument compatibility with the other set states
  function set_tom1_state(id, mode, make_sound) {
    set_tom_state(id, 1, mode, make_sound);
  }

  function set_tom2_state(id, mode, make_sound) {
    set_tom_state(id, 2, mode, make_sound);
  }

  function set_tom3_state(id, mode, make_sound) {
    set_tom_state(id, 3, mode, make_sound);
  }

  function set_tom4_state(id, mode, make_sound) {
    set_tom_state(id, 4, mode, make_sound);
  }

  // is the any kick note on for this note in the measure?

  // returns the ABC notation for the kick state
  // false = off
  // "F" = normal kick
  // "^d," = splash
  // "F^d,"  = kick & splash

  // set the kick note on with type
  function set_kick_state(id, mode, make_sound) {
    // hide everything optional
    document.getElementById('kick_circle' + id).style.backgroundColor =
      constant_note_hidden_color_rgb;
    document.getElementById('kick_splash' + id).style.color = constant_note_hidden_color_rgb;

    // turn stuff on conditionally
    switch (mode) {
      case 'off':
        document.getElementById('kick_circle' + id).style.backgroundColor =
          constant_note_off_color_hex;
        document.getElementById('kick_circle' + id).style.borderColor =
          constant_note_border_color_hex;
        break;
      case 'normal':
        document.getElementById('kick_circle' + id).style.backgroundColor =
          constant_note_on_color_hex;
        document.getElementById('kick_circle' + id).style.borderColor =
          constant_note_border_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_KICK_NORMAL);
        break;
      case 'splash':
        document.getElementById('kick_splash' + id).style.color = constant_note_on_color_hex;
        document.getElementById('kick_circle' + id).style.borderColor =
          constant_note_hidden_color_rgb;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_HIHAT_FOOT);
        break;
      case 'kick_and_splash':
        document.getElementById('kick_circle' + id).style.backgroundColor =
          constant_note_on_color_hex;
        document.getElementById('kick_splash' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_HIHAT_FOOT);
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_KICK_NORMAL);
        break;
      default:
        console.log('bad switch in set_kick_state');
        break;
    }
  }

  function set_snare_state(id, mode, make_sound) {
    // hide everything optional
    document.getElementById('snare_circle' + id).style.backgroundColor =
      constant_note_hidden_color_rgb;
    document.getElementById('snare_circle' + id).style.borderColor = constant_note_hidden_color_rgb;
    document.getElementById('snare_ghost' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('snare_accent' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('snare_xstick' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('snare_buzz' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('snare_flam' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('snare_drag' + id).style.color = constant_note_hidden_color_rgb;

    // turn stuff on conditionally
    switch (mode) {
      case 'off':
        document.getElementById('snare_circle' + id).style.backgroundColor =
          constant_note_off_color_hex;
        document.getElementById('snare_circle' + id).style.borderColor =
          constant_note_border_color_hex;
        break;
      case 'normal':
        document.getElementById('snare_circle' + id).style.backgroundColor =
          constant_note_on_color_hex;
        document.getElementById('snare_circle' + id).style.borderColor =
          constant_note_border_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_SNARE_NORMAL);
        break;
      case 'flam':
        document.getElementById('snare_flam' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_SNARE_FLAM);
        break;
      case 'drag':
        document.getElementById('snare_drag' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_SNARE_DRAG);
        break;
      case 'ghost':
        document.getElementById('snare_ghost' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_SNARE_GHOST);
        break;
      case 'accent':
        document.getElementById('snare_circle' + id).style.backgroundColor =
          constant_note_on_color_hex;
        document.getElementById('snare_circle' + id).style.borderColor =
          constant_note_border_color_hex;
        document.getElementById('snare_accent' + id).style.color =
          constant_snare_accent_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_SNARE_ACCENT);
        break;
      case 'xstick':
        document.getElementById('snare_xstick' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_SNARE_XSTICK);
        break;
      case 'buzz':
        document.getElementById('snare_buzz' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_SNARE_BUZZ);
        break;
      default:
        console.log('bad switch in set_snare_state');
        break;
    }
  }

  // returns the ABC notation for the HH state
  // false = off
  // see the top constants for mappings

  // TODO: refactor this using a lookup table of constants
  function set_hh_state(id, mode, make_sound) {
    // hide everything optional
    document.getElementById('hh_cross' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('hh_ride' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('hh_ride_bell' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('hh_cow_bell' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('hh_crash' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('hh_stacker' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('hh_metronome_normal' + id).style.color =
      constant_note_hidden_color_rgb;
    document.getElementById('hh_metronome_accent' + id).style.color =
      constant_note_hidden_color_rgb;
    document.getElementById('hh_open' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('hh_close' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('hh_accent' + id).style.color = constant_note_hidden_color_rgb;

    // turn stuff on conditionally
    switch (mode) {
      case 'off':
        document.getElementById('hh_cross' + id).style.color = constant_hihat_note_off_color_hex;
        break;
      case 'normal':
        document.getElementById('hh_cross' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_HIHAT_NORMAL);
        break;
      case 'ride':
        document.getElementById('hh_ride' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_HIHAT_RIDE);
        break;
      case 'ride_bell':
        document.getElementById('hh_ride_bell' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_HIHAT_RIDE_BELL);
        break;
      case 'cow_bell':
        document.getElementById('hh_cow_bell' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_HIHAT_COW_BELL);
        break;
      case 'crash':
        document.getElementById('hh_crash' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_HIHAT_CRASH);
        break;
      case 'stacker':
        document.getElementById('hh_stacker' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_HIHAT_STACKER);
        break;
      case 'metronome_normal':
        document.getElementById('hh_metronome_normal' + id).style.color =
          constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_HIHAT_METRONOME_NORMAL);
        break;
      case 'metronome_accent':
        document.getElementById('hh_metronome_accent' + id).style.color =
          constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_HIHAT_METRONOME_ACCENT);
        break;
      case 'open':
        document.getElementById('hh_cross' + id).style.color = constant_note_on_color_hex;
        document.getElementById('hh_open' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_HIHAT_OPEN);
        break;
      case 'close':
        document.getElementById('hh_cross' + id).style.color = constant_note_on_color_hex;
        document.getElementById('hh_close' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_HIHAT_NORMAL);
        break;
      case 'accent':
        document.getElementById('hh_cross' + id).style.color = constant_note_on_color_hex;
        document.getElementById('hh_accent' + id).style.color = constant_note_on_color_hex;
        if (make_sound) play_single_note_for_note_setting(constant_OUR_MIDI_HIHAT_ACCENT);
        break;
      default:
        console.log('bad switch in set_hh_state');
        break;
    }
  }

  function set_sticking_state(id, new_state, make_sound) {
    // turn both off
    document.getElementById('sticking_right' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('sticking_left' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('sticking_both' + id).style.color = constant_note_hidden_color_rgb;
    document.getElementById('sticking_count' + id).style.color = constant_note_hidden_color_rgb;

    switch (new_state) {
      case 'off':
        // show them all greyed out.
        document.getElementById('sticking_right' + id).style.color =
          constant_sticking_right_off_color_rgb;
        document.getElementById('sticking_left' + id).style.color =
          constant_sticking_left_off_color_rgb;
        break;
      case 'right':
        document.getElementById('sticking_right' + id).style.color =
          constant_sticking_right_on_color_rgb;
        break;
      case 'left':
        document.getElementById('sticking_left' + id).style.color =
          constant_sticking_left_on_color_rgb;
        break;
      case 'both':
        document.getElementById('sticking_both' + id).style.color =
          constant_sticking_both_on_color_rgb;
        break;
      case 'count':
        var count_state = root.myGrooveUtils.figure_out_sticking_count_for_index(
          id,
          class_notes_per_measure,
          class_time_division,
          class_note_value_per_measure
        );

        document.getElementById('sticking_count' + id).style.color =
          constant_sticking_count_on_color_rgb;
        document.getElementById('sticking_count' + id).innerHTML = '' + count_state;
        break;

      default:
        console.log('Bad state in set_sticking_state: ' + new_state);
        break;
    }
  }

  function sticking_rotate_state(id) {
    var new_state = false;
    var sticking_state = get_sticking_state(id, 'ABC');

    // figure out the next state
    // we could get fancy here and default down strokes to R and upstrokes to L
    // for now we will rotate through (Off, R, L, BOTH) in order
    if (sticking_state == constant_ABC_STICK_OFF) {
      new_state = 'right';
    } else if (sticking_state == constant_ABC_STICK_R) {
      new_state = 'left';
    } else if (sticking_state == constant_ABC_STICK_L) {
      new_state = 'both';
    } else if (sticking_state == constant_ABC_STICK_BOTH) {
      new_state = 'count';
    } else {
      new_state = 'off';
    }

    set_sticking_state(id, new_state, true);
  }

  // highlight the note, this is used to play along with the midi track
  // only one note for each instrument can be highlighted at a time
  // Also unhighlight other instruments if their index is not equal to the passed in index
  // this means that only notes falling on the current beat will be highlighted.
  var class_cur_hh_highlight_id = false;
  var class_cur_tom1_highlight_id = false;
  var class_cur_tom2_highlight_id = false;
  var class_cur_tom3_highlight_id = false;
  var class_cur_tom4_highlight_id = false;
  var class_cur_snare_highlight_id = false;
  var class_cur_kick_highlight_id = false;

  var class_cur_all_notes_highlight_id = false;

  function hilight_all_notes_on_same_beat(instrument, id) {
    id = Math.floor(id);
    if (id < 0 || id >= class_notes_per_measure * class_number_of_measures) return;

    // Ben: with a per-beat grid many cells are hidden; light up the nearest visible cell
    // at or before this position (within the same bar) instead of an invisible one.
    var barStart = id - (id % class_notes_per_measure);
    var snap = id;
    while (snap > barStart) {
      var cell = document.getElementById('bg-highlight' + snap);
      if (!cell || cell.style.display != 'none') break;
      snap--;
    }
    id = snap;

    if (class_cur_all_notes_highlight_id === id) return; // already highligted

    if (class_cur_all_notes_highlight_id !== false) {
      // turn off old highlighting
      var bg_ele = document.getElementById('bg-highlight' + class_cur_all_notes_highlight_id);
      if (bg_ele) {
        bg_ele.style.background = 'transparent';
      }
    }

    // turn this one on;
    class_cur_all_notes_highlight_id = id;
    document.getElementById('bg-highlight' + class_cur_all_notes_highlight_id).style.background =
      'rgba(50, 126, 173, 0.2)';
  }

  function hilight_note(instrument, percent_complete) {
    if (percent_complete < 0) {
      clear_all_highlights('clear');
      return;
    }

    // Ben: follow the bars that are actually playing (mixed meters, loops, play-from)
    if (class_permutation_type == 'none' && class_play_timeline.length) {
      var pos = timelinePosition(percent_complete);
      if (pos) {
        followPlayingBar(pos.bar);
        hilight_all_notes_on_same_beat(
          instrument,
          pos.bar * class_notes_per_measure +
            Math.floor((pos.slot * class_notes_per_measure) / fullSlotsPerMeasure())
        );
        return;
      }
    }

    // if we are in a permutation, hightlight each measure as it goes
    if (class_permutation_type != 'none')
      percent_complete = (percent_complete * get_numberOfActivePermutationSections()) % 1.0;

    var note_id_in_32 = Math.floor(
      percent_complete *
        root.myGrooveUtils.calc_notes_per_measure(
          usingTriplets() ? 48 : 32,
          class_num_beats_per_measure,
          class_note_value_per_measure
        ) *
        class_number_of_measures
    );
    var real_note_id =
      note_id_in_32 /
      root.myGrooveUtils.getNoteScaler(
        class_notes_per_measure,
        class_num_beats_per_measure,
        class_note_value_per_measure
      );

    //hilight_individual_note(instrument, id);
    hilight_all_notes_on_same_beat(instrument, real_note_id);
  }

  function clear_all_highlights(instrument) {
    class_followed_bar = -1;
    // now turn off  notes if necessary;
    if (class_cur_hh_highlight_id !== false) {
      document.getElementById('hi-hat' + class_cur_hh_highlight_id).style.borderColor =
        'transparent';
      class_cur_hh_highlight_id = false;
    }
    if (class_cur_tom1_highlight_id !== false) {
      document.getElementById('tom1-' + class_cur_tom1_highlight_id).style.borderColor =
        'transparent';
      class_cur_tom1_highlight_id = false;
    }
    if (class_cur_tom2_highlight_id !== false) {
      document.getElementById('tom2-' + class_cur_tom2_highlight_id).style.borderColor =
        'transparent';
      class_cur_tom2_highlight_id = false;
    }
    if (class_cur_tom3_highlight_id !== false) {
      document.getElementById('tom3-' + class_cur_tom3_highlight_id).style.borderColor =
        'transparent';
      class_cur_tom3_highlight_id = false;
    }
    if (class_cur_tom4_highlight_id !== false) {
      document.getElementById('tom4-' + class_cur_tom4_highlight_id).style.borderColor =
        'transparent';
      class_cur_tom4_highlight_id = false;
    }
    if (class_cur_snare_highlight_id !== false) {
      document.getElementById('snare' + class_cur_snare_highlight_id).style.borderColor =
        'transparent';
      class_cur_snare_highlight_id = false;
    }
    if (class_cur_kick_highlight_id !== false) {
      document.getElementById('kick' + class_cur_kick_highlight_id).style.borderColor =
        'transparent';
      class_cur_kick_highlight_id = false;
    }

    if (class_cur_all_notes_highlight_id !== false) {
      // turn off old highlighting
      var bg_ele = document.getElementById('bg-highlight' + class_cur_all_notes_highlight_id);
      if (bg_ele) {
        bg_ele.style.background = 'transparent';
      }
      class_cur_all_notes_highlight_id = false;
    }
  }

  function getTagPosition(tag) {
    var xVal = 0,
      yVal = 0;
    while (tag) {
      xVal += tag.offsetLeft - tag.scrollLeft + tag.clientLeft;
      yVal += tag.offsetTop - tag.scrollTop + tag.clientTop;
      tag = tag.offsetParent;
    }
    return {
      x: xVal,
      y: yVal,
    };
  }

  // called every time the tempo changes, which can be a lot of times due to the range slider
  // update the main URL with the tempo, but only do it every third of a second at the most
  var global_tempoChangeCallbackTimeout = null;
  root.tempoChangeCallback = function (newTempo) {
    // if there is a timeout running clear it
    if (global_tempoChangeCallbackTimeout != null)
      window.clearTimeout(global_tempoChangeCallbackTimeout);

    // set a new timeout
    global_tempoChangeCallbackTimeout = window.setTimeout(function () {
      global_tempoChangeCallbackTimeout = null;
      // update the Main URL to show the new tempo
      root.updateCurrentURL();
    }, 300);
  };

  root.setMetronomeButton = function (metronomeInterval) {
    var id = '';
    switch (metronomeInterval) {
      case 4:
        id = 'metronome4ths';
        break;
      case 8:
        id = 'metronome8ths';
        break;
      case 16:
        id = 'metronome16ths';
        break;
      case 12:
        id = 'metronomeTrip';
        break;
      case 24:
        id = 'metronomeSext';
        break;
      case 0:
      /* falls through */
      default:
        id = 'metronomeOff';
        if (root.myGrooveUtils.getMetronomeSolo()) {
          // turn off solo if we are turning off the metronome
          root.metronomeOptionsMenuPopupClick('Solo');
        }
        break;
    }

    // clear other buttons
    var myElements = document.querySelectorAll('.metronomeButton');
    for (var i = 0; i < myElements.length; i++) {
      var thisButton = myElements[i];
      // remove active status
      unselectButton(thisButton);
    }

    selectButton(document.getElementById(id));

    root.myGrooveUtils.midiNoteHasChanged(); // pretty likely the case
  };

  root.class_metronome_frequency = 0;
  root.getMetronomeFrequency = function () {
    return root.class_metronome_frequency;
  };

  root.setMetronomeFrequency = function (newFrequency) {
    var changed = root.class_metronome_frequency != newFrequency;
    root.class_metronome_frequency = newFrequency;
    root.setMetronomeButton(newFrequency);
    // Ben: rebuild the MIDI so the change is heard right away (it used to wait for some other edit)
    if (changed && root.myGrooveUtils) {
      root.myGrooveUtils.midiNoteHasChanged();
      if (root.myGrooveUtils.isPlaying && root.myGrooveUtils.isPlaying()) {
        root.myGrooveUtils.stopMIDI_playback();
        root.myGrooveUtils.startMIDI_playback();
      }
    }

    // update the current URL so that reloads and history traversal and link shares and bookmarks work correctly
    root.updateCurrentURL();
  };

  // the user has clicked on the metronome options button
  root.metronomeOptionsAnchorClick = function (event) {
    var contextMenu = document.getElementById('metronomeOptionsContextMenu');
    if (contextMenu) {
      var anchorPoint = document.getElementById('metronomeOptionsAnchor');

      if (anchorPoint) {
        var anchorPos = getTagPosition(anchorPoint);
        contextMenu.style.top = anchorPos.y + anchorPoint.offsetHeight + 'px';
        contextMenu.style.left = anchorPos.x + anchorPoint.offsetWidth - 150 + 'px';
      }

      root.myGrooveUtils.showContextMenu(contextMenu);
    }
  };

  // the user has clicked on the permutation menu
  root.permutationAnchorClick = function (event) {
    if (class_num_beats_per_measure != 4 || class_note_value_per_measure != 4) return; // permutations disabled except in 4/4 time

    var contextMenu = document.getElementById('permutationContextMenu');
    if (contextMenu) {
      var anchorPoint = document.getElementById('permutationAnchor');

      if (anchorPoint) {
        var anchorPos = getTagPosition(anchorPoint);
        contextMenu.style.top = anchorPos.y + anchorPoint.offsetHeight + 'px';
        contextMenu.style.left = anchorPos.x + anchorPoint.offsetWidth - 150 + 'px';
      }
      root.myGrooveUtils.showContextMenu(contextMenu);
    }
  };

  // the user has clicked on the grooves menu
  root.groovesAnchorClick = function (event) {
    var contextMenu = document.getElementById('grooveListWrapper');
    if (contextMenu) {
      var anchorPoint = document.getElementById('groovesAnchor');

      if (anchorPoint) {
        var anchorPos = getTagPosition(anchorPoint);
        contextMenu.style.top = anchorPos.y + anchorPoint.offsetHeight + 'px';
        contextMenu.style.left = anchorPos.x + anchorPoint.offsetWidth - 283 + 'px';
      }
      root.myGrooveUtils.showContextMenu(contextMenu);
    }
  };

  // the user has clicked on the help menu
  root.helpAnchorClick = function (event) {
    var contextMenu = document.getElementById('helpContextMenu');
    if (contextMenu) {
      var anchorPoint = document.getElementById('helpAnchor');

      if (anchorPoint) {
        var anchorPos = getTagPosition(anchorPoint);
        contextMenu.style.top = anchorPos.y + anchorPoint.offsetHeight + 'px';
        contextMenu.style.left = anchorPos.x + anchorPoint.offsetWidth - 150 + 'px';
      }
      root.myGrooveUtils.showContextMenu(contextMenu);
    }
  };

  // the user has clicked on the stickings menu (at bottom)
  var class_stickings_menu_was_open = false;
  document.addEventListener(
    'pointerdown',
    function (e) {
      if (e.target.closest && e.target.closest('#stickingsButton')) {
        var mnu = document.getElementById('stickingsContextMenu');
        class_stickings_menu_was_open = !!mnu && mnu.style.display == 'block';
      }
    },
    true
  );
  root.stickingsAnchorClick = function (event) {
    var contextMenu = document.getElementById('stickingsContextMenu');
    if (contextMenu && class_stickings_menu_was_open) {
      // second click on STICKINGS closes the menu again
      class_stickings_menu_was_open = false;
      root.myGrooveUtils.hideContextMenu(contextMenu);
      return;
    }
    if (contextMenu) {
      var anchorPoint = document.getElementById('stickingsButton');

      if (anchorPoint) {
        if (!event) event = window.event;
        if (event.clientX || event.clientY) {
          contextMenu.style.top = event.clientY - 100 + 'px';
          contextMenu.style.left = event.clientX - 150 + 'px';
        }
      }
      root.myGrooveUtils.showContextMenu(contextMenu);
    }
  };

  // the user has clicked on the download menu (at bottom)
  root.DownloadAnchorClick = function (event) {
    var contextMenu = document.getElementById('downloadContextMenu');
    if (contextMenu) {
      var anchorPoint = document.getElementById('downloadButton');

      if (anchorPoint) {
        if (!event) event = window.event;
        if (event.clientX || event.clientY) {
          contextMenu.style.top = event.clientY - 150 + 'px';
          contextMenu.style.left = event.clientX - 150 + 'px';
        }
      }
      root.myGrooveUtils.showContextMenu(contextMenu);
    }
  };

  // figure out if the metronome options menu should be selected and change the UI
  root.metronomeOptionsMenuSetSelectedState = function () {
    if (
      root.myGrooveUtils.getMetronomeSolo() ||
      class_metronome_auto_speed_up_active ||
      root.myGrooveUtils.getMetronomeOffsetClickStart() != '1'
    ) {
      // make menu look active
      addOrRemoveKeywordFromClassById('metronomeOptionsAnchor', 'selected', true);
    } else {
      // inactive
      addOrRemoveKeywordFromClassById('metronomeOptionsAnchor', 'selected', false);
    }
  };

  root.metronomeOptionsMenuPopupClick = function (option_type) {
    switch (option_type) {
      case 'Solo':
        var current = root.myGrooveUtils.getMetronomeSolo();
        if (!current) {
          root.myGrooveUtils.setMetronomeSolo(true);
          addOrRemoveKeywordFromClassById('metronomeOptionsContextMenuSolo', 'menuChecked', true);
          if (root.getMetronomeFrequency() === 0) root.setMetronomeFrequency(4);
        } else {
          root.myGrooveUtils.setMetronomeSolo(false);
          addOrRemoveKeywordFromClassById('metronomeOptionsContextMenuSolo', 'menuChecked', false);
        }
        root.myGrooveUtils.midiNoteHasChanged(); // if playing need to refresh
        break;

      case 'SpeedUp':
        if (class_metronome_auto_speed_up_active) {
          // just turn it off if it is on, don't show the configurator
          class_metronome_auto_speed_up_active = false;
          addOrRemoveKeywordFromClassById(
            'metronomeOptionsContextMenuSpeedUp',
            'menuChecked',
            false
          );
        } else {
          class_metronome_auto_speed_up_active = true;
          addOrRemoveKeywordFromClassById(
            'metronomeOptionsContextMenuSpeedUp',
            'menuChecked',
            true
          );
          root.show_MetronomeAutoSpeedupConfiguration();
        }
        break;

      case 'CountIn':
        if (class_metronome_count_in_active) {
          // just turn it off if it is on, don't show the configurator
          class_metronome_count_in_active = false;
          addOrRemoveKeywordFromClassById(
            'metronomeOptionsContextMenuCountIn',
            'menuChecked',
            false
          );
          root.myGrooveUtils.setMetronomeCountIn(false);
        } else {
          class_metronome_count_in_active = true;
          addOrRemoveKeywordFromClassById(
            'metronomeOptionsContextMenuCountIn',
            'menuChecked',
            true
          );
          root.myGrooveUtils.setMetronomeCountIn(true);
        }
        break;

      case 'OffTheOne':
        // bring up the next menu to be clicked
        var contextMenu;

        if (usingTriplets())
          contextMenu = document.getElementById(
            'metronomeOptionsOffsetClickForTripletsContextMenu'
          );
        else contextMenu = document.getElementById('metronomeOptionsOffsetClickContextMenu');
        if (contextMenu) {
          var anchorPoint = document.getElementById('metronomeOptionsContextMenuOffTheOne');

          if (anchorPoint) {
            var anchorPos = getTagPosition(anchorPoint);
            contextMenu.style.top = anchorPos.y + anchorPoint.offsetHeight + 'px';
            contextMenu.style.left = anchorPos.x + anchorPoint.offsetWidth - 150 + 'px';
          }
          root.myGrooveUtils.showContextMenu(contextMenu);
        }
        break;

      case 'Dropper':
        break;

      default:
        console.log('bad case in metronomeOptionsMenuPopupClick()');
        break;
    }

    root.metronomeOptionsMenuSetSelectedState();
  };

  root.metronomeOptionsMenuOffsetClickPopupClick = function (option_type) {
    root.myGrooveUtils.setMetronomeOffsetClickStart(option_type);

    // clear other and select
    var myElements = document.querySelectorAll('.metronomeOptionsOffsetClickContextMenuItem');
    for (var i = 0; i < myElements.length; i++) {
      var thisItem = myElements[i];
      // remove active status
      addOrRemoveKeywordFromClass(thisItem, 'menuChecked', false);
    }

    // turn on the new one selected
    addOrRemoveKeywordFromClassById(
      'metronomeOptionsOffsetClickContextMenuOnThe' + option_type,
      'menuChecked',
      true
    );

    if (option_type != '1') {
      // 1 is the default state
      // add a check to the menu
      addOrRemoveKeywordFromClassById('metronomeOptionsContextMenuOffTheOne', 'menuChecked', true);
    } else {
      addOrRemoveKeywordFromClassById('metronomeOptionsContextMenuOffTheOne', 'menuChecked', false);
    }

    root.myGrooveUtils.midiNoteHasChanged();
    root.metronomeOptionsMenuSetSelectedState();
  };

  root.resetMetronomeOptionsMenuOffsetClick = function () {
    // call with the default option
    root.metronomeOptionsMenuOffsetClickPopupClick('1');
  };

  function setupPermutationMenu() {
    if (class_num_beats_per_measure == 4 && class_note_value_per_measure == 4) {
      addOrRemoveKeywordFromClassById('permutationAnchor', 'enabled', true);
    } else {
      // permutations disabled except in 4/4 time
      addOrRemoveKeywordFromClassById('permutationAnchor', 'enabled', false);
      root.permutationPopupClick('none'); // make sure permutation is off
    }
  }

  root.permutationPopupClick = function (perm_type) {
    if (class_permutation_type == perm_type) return;

    class_permutation_type = perm_type;

    switch (perm_type) {
      case 'kick_16ths':
        showHideCSS_ClassVisibility('.kick-container', true, false); // hide it
        showHideCSS_ClassVisibility('.snare-container', true, true); // show it
        while (class_number_of_measures > 1) {
          root.closeMeasureButtonClick(2);
        }
        selectButton(document.getElementById('permutationAnchor'));
        document.getElementById('PermutationOptions').innerHTML = root.HTMLforPermutationOptions();
        document.getElementById('PermutationOptions').className += ' displayed';
        break;

      case 'snare_16ths':
        showHideCSS_ClassVisibility('.kick-container', true, true); // show it
        showHideCSS_ClassVisibility('.snare-container', true, false); // hide it
        while (class_number_of_measures > 1) {
          root.closeMeasureButtonClick(2);
        }
        selectButton(document.getElementById('permutationAnchor'));
        document.getElementById('PermutationOptions').innerHTML = root.HTMLforPermutationOptions();
        document.getElementById('PermutationOptions').className += ' displayed';
        break;

      case 'none':
      /* falls through */
      default:
        showHideCSS_ClassVisibility('.kick-container', true, true); // show it
        showHideCSS_ClassVisibility('.snare-container', true, true); // show it
        class_permutation_type = 'none';

        unselectButton(document.getElementById('permutationAnchor'));
        document.getElementById('PermutationOptions').innerHTML = root.HTMLforPermutationOptions();
        addOrRemoveKeywordFromClassById('PermutationOptions', 'displayed', false);
        break;
    }

    updateSheetMusic();
  };

  root.muteInstrument = function (instrument, measure, muteElseUnmute) {
    // find unmuteHHButton1  or unmuteSnareButton2
    var buttonName = 'unmute' + instrument + 'Button' + measure;
    var button = document.getElementById(buttonName);
    if (muteElseUnmute) button.style.display = 'inline-block';
    else button.style.display = 'none';

    root.myGrooveUtils.midiNoteHasChanged();
  };

  function isInstrumentMuted(instrument, measure) {
    // find unmuteHHButton1  or unmuteSnareButton2
    var buttonName = 'unmute' + instrument + 'Button' + measure;
    var button = document.getElementById(buttonName);
    if (button && button.style.display == 'inline-block') return true;
    else return false;
  }

  root.helpMenuPopupClick = function (help_type) {
    var win;

    switch (help_type) {
      case 'help':
        win = window.open('./gscribe_help.html', '_blank');
        win.focus();
        break;

      case 'about':
        win = window.open('./gscribe_about.html', '_blank');
        win.focus();
        break;

      case 'undo':
        root.undoCommand();
        break;

      case 'redo':
        root.redoCommand();
        break;

      default:
        console.log('bad case in helpMenuPopupClick()');
        break;
    }
  };

  // user has clicked on the advanced edit button
  this.toggleAdvancedEdit = function () {
    if (class_advancedEditIsOn) {
      // turn it off
      class_advancedEditIsOn = false;
      unselectButton(document.getElementById('advancedEditAnchor'));
    } else {
      class_advancedEditIsOn = true;
      selectButton(document.getElementById('advancedEditAnchor'));
    }
  };

  // context menu for labels
  root.noteLabelClick = function (event, instrument, measure) {
    var contextMenu = false;

    // store this in a global, there can only ever be one context menu open at a time.
    // Yes, I agree this sucks
    class_measure_for_note_label_click = measure;

    switch (instrument) {
      case 'stickings':
        contextMenu = document.getElementById('stickingsLabelContextMenu');
        break;
      case 'hh':
        contextMenu = document.getElementById('hhLabelContextMenu');
        break;
      case 'tom1':
        contextMenu = document.getElementById('tom1LabelContextMenu');
        break;
      case 'tom2':
        contextMenu = document.getElementById('tom2LabelContextMenu');
        break;
      case 'tom3':
        contextMenu = document.getElementById('tom3LabelContextMenu');
        break;
      case 'tom4':
        contextMenu = document.getElementById('tom4LabelContextMenu');
        break;
      case 'snare':
        contextMenu = document.getElementById('snareLabelContextMenu');
        break;
      case 'kick':
        contextMenu = document.getElementById('kickLabelContextMenu');
        break;
      default:
        console.log('bad case in noteLabelClick: ' + instrument);
        break;
    }

    if (contextMenu) {
      if (!event) event = window.event;
      if (event.clientX || event.clientY) {
        contextMenu.style.top = event.clientY - 30 + 'px';
        contextMenu.style.left = event.clientX - 35 + 'px';
      }
      root.myGrooveUtils.showContextMenu(contextMenu);
    }

    return false;
  };

  function benNoteIsOn(instrument, id) {
    switch (instrument) {
      case 'hh':
        return get_hh_state(id, 'ABC') !== false;
      case 'snare':
        return get_snare_state(id, 'ABC') !== false;
      case 'kick':
        return get_kick_state(id, 'ABC') !== false;
      case 'tom1':
      case 'tom2':
      case 'tom3':
      case 'tom4':
        return get_tom_state(id, parseInt(instrument.slice(3), 10), 'ABC') !== false;
    }
    return false;
  }

  root.noteLabelPopupClick = function (instrument, action) {
    var setFunction = false;

    switch (instrument) {
      case 'stickings':
        setFunction = set_sticking_state;
        break;
      case 'hh':
        setFunction = set_hh_state;
        break;
      case 'tom1':
        setFunction = set_tom1_state;
        break;
      case 'tom2':
        setFunction = set_tom2_state;
        break;
      case 'tom3':
        setFunction = set_tom3_state;
        break;
      case 'tom4':
        setFunction = set_tom4_state;
        break;
      case 'snare':
        setFunction = set_snare_state;
        break;
      case 'kick':
        setFunction = set_kick_state;
        break;
      default:
        console.log('bad case in noteLabelPopupClick');
        return false;
    }

    if (action == 'mute') {
      root.muteInstrument(instrument, class_measure_for_note_label_click, true);
      return false;
    }

    // start at the first note of the measure we want to effect.   Only fill in the
    // notes for that measure
    // the last boolean in the setFunction should only be true on the first call (plays a sound)
    var startIndex = class_notes_per_measure * (class_measure_for_note_label_click - 1);
    for (var i = startIndex; i - startIndex < class_notes_per_measure; i++) {
      if (action == 'all_off') {
        setFunction(i, 'off', i == startIndex);
      } else if (instrument == 'stickings') {
        switch (action) {
          case 'all_right':
            set_sticking_state(i, 'right', i == startIndex);
            break;
          case 'all_left':
            set_sticking_state(i, 'left', i == startIndex);
            break;
          case 'alternate':
            set_sticking_state(i, i % 2 === 0 ? 'right' : 'left', i == startIndex);
            break;
          case 'all_count':
            set_sticking_state(i, 'count', i == startIndex);
            break;
          default:
            console.log('Bad sticking case in noteLabelPopupClick');
            break;
        }
      } else if (instrument == 'hh' && action == 'downbeats') {
        set_hh_state(i, i % 2 === 0 ? 'normal' : 'off', i == startIndex);
      } else if (instrument == 'hh' && action == 'upbeats') {
        set_hh_state(i, i % 2 === 0 ? 'off' : 'normal', i == startIndex + 1);
      } else if (instrument == 'snare' && action == 'all_on') {
        set_snare_state(i, 'accent', i == startIndex);
      } else if (instrument == 'snare' && action == 'all_on_normal') {
        set_snare_state(i, 'normal', i == startIndex);
      } else if (instrument == 'snare' && action == 'all_on_ghost') {
        set_snare_state(i, 'ghost', i == startIndex);
      } else if (instrument == 'kick' && action == 'hh_foot_nums_on') {
        var num_notes_per_count = class_time_division / class_note_value_per_measure;
        var cur_state = get_kick_state(i, 'ABC');
        var kick_is_on = false;
        if (cur_state == constant_ABC_KI_SandK || cur_state == constant_ABC_KI_Normal)
          kick_is_on = true;
        set_kick_state(
          i,
          i % num_notes_per_count === 0
            ? kick_is_on
              ? 'kick_and_splash'
              : 'splash'
            : kick_is_on
              ? 'normal'
              : 'off',
          i == startIndex
        );
      } else if (instrument == 'kick' && action == 'hh_foot_ands_on') {
        num_notes_per_count = class_time_division / class_note_value_per_measure;
        cur_state = get_kick_state(i, 'ABC');
        kick_is_on = false;
        if (cur_state == constant_ABC_KI_SandK || cur_state == constant_ABC_KI_Normal)
          kick_is_on = true;

        set_kick_state(
          i,
          i % num_notes_per_count === num_notes_per_count / 2
            ? kick_is_on
              ? 'kick_and_splash'
              : 'splash'
            : kick_is_on
              ? 'normal'
              : 'off',
          i == startIndex + num_notes_per_count / 2
        );
      } else if (action.indexOf('convert_') === 0) {
        // Ben: change every note that is on into another kind (e.g. all accents -> normal)
        if (benNoteIsOn(instrument, i)) setFunction(i, action.slice(8), false);
      } else if (action == 'all_on') {
        setFunction(i, 'normal', i == startIndex);
      } else if (action == 'cancel') {
        continue; // do nothing.
      } else {
        console.log('Bad IF case in noteLabelPopupClick');
      }
    }

    // Ben: never leave notes in cells the per-beat grid hides (they would play but not show)
    var cellPrefix = { stickings: 'sticking', hh: 'hi-hat', tom1: 'tom1-', tom2: 'tom2-', tom3: 'tom3-', tom4: 'tom4-', snare: 'snare', kick: 'kick' }[instrument];
    for (var h = startIndex; h - startIndex < class_notes_per_measure; h++) {
      var cellEl = document.getElementById(cellPrefix + h);
      if (cellEl && cellEl.style.display == 'none') setFunction(h, 'off', false);
    }

    class_measure_for_note_label_click = 0; // reset

    updateSheetMusic();

    return false;
  };

  // returns true on error!
  // returns false if working.  (this is because of the onContextMenu handler
  root.noteRightClick = function (event, type, id) {
    class_which_index_last_clicked = id;
    var contextMenu;

    switch (type) {
      case 'sticking':
        contextMenu = document.getElementById('stickingContextMenu');
        break;
      case 'hh':
        contextMenu = document.getElementById('hhContextMenu');
        break;
      case 'tom1':
        contextMenu = document.getElementById('tom1ContextMenu');
        break;
      case 'tom2':
        contextMenu = document.getElementById('tom2ContextMenu');
        break;
      case 'tom3':
        contextMenu = document.getElementById('tom3ContextMenu');
        break;
      case 'tom4':
        contextMenu = document.getElementById('tom4ContextMenu');
        break;
      case 'snare':
        contextMenu = document.getElementById('snareContextMenu');
        break;
      case 'kick':
        contextMenu = document.getElementById('kickContextMenu');
        break;
      default:
        console.log('Bad case in handleNotePopup');
        break;
    }

    if (contextMenu) {
      if (!event) event = window.event;
      if (event.clientX || event.clientY) {
        contextMenu.style.top = event.clientY - 30 + 'px';
        contextMenu.style.left = event.clientX - 75 + 'px';
      }
      root.myGrooveUtils.showContextMenu(contextMenu);
    } else {
      return true; //error
    }

    return false;
  };

  root.noteLeftClick = function (event, type, id) {
    // use a popup if advanced edit is on
    if (class_advancedEditIsOn === true) {
      root.noteRightClick(event, type, id);
    } else {
      // this is a non advanced edit left click
      switch (type) {
        case 'hh':
          set_hh_state(id, is_hh_on(id) ? 'off' : 'normal', true);
          break;
        case 'snare':
          set_snare_state(id, is_snare_on(id) ? 'off' : 'accent', true);
          break;
        case 'tom1':
          set_tom_state(id, 1, is_tom_on(id, 1) ? 'off' : 'normal', true);
          break;
        case 'tom2':
          set_tom_state(id, 2, is_tom_on(id, 2) ? 'off' : 'normal', true);
          break;
        case 'tom3':
          set_tom_state(id, 3, is_tom_on(id, 3) ? 'off' : 'normal', true);
          break;
        case 'tom4':
          set_tom_state(id, 4, is_tom_on(id, 4) ? 'off' : 'normal', true);
          break;
        case 'kick':
          set_kick_state(id, is_kick_on(id) ? 'off' : 'normal', true);
          break;
        case 'sticking':
          sticking_rotate_state(id);
          break;
        default:
          console.log('Bad case in noteLeftClick: ' + type);
          break;
      }

      updateSheetMusic();
    }
  };

  root.notePopupClick = function (type, new_setting) {
    var id = class_which_index_last_clicked;

    switch (type) {
      case 'sticking':
        set_sticking_state(id, new_setting, true);
        break;
      case 'hh':
        set_hh_state(id, new_setting, true);
        break;
      case 'tom1':
        set_tom1_state(id, new_setting, true);
        break;
      case 'tom2':
        set_tom2_state(id, new_setting, true);
        break;
      case 'tom3':
        set_tom3_state(id, new_setting, true);
        break;
      case 'tom4':
        set_tom4_state(id, new_setting, true);
        break;
      case 'snare':
        set_snare_state(id, new_setting, true);
        break;
      case 'kick':
        set_kick_state(id, new_setting, true);
        break;
      default:
        console.log('Bad case in contextMenuClick');
        break;
    }

    updateSheetMusic();
  };

  // called when we initially mouseOver a note.
  // We can use it to sense left or right mouse or ctrl events
  root.noteOnMouseEnter = function (event, instrument, id) {
    var action = false;

    if (event.ctrlKey) action = 'on';
    if (event.altKey) action = 'off';

    if (action) {
      switch (instrument) {
        case 'hh':
          set_hh_state(id, action == 'off' ? 'off' : 'normal', true);
          break;
        case 'snare':
          set_snare_state(id, action == 'off' ? 'off' : 'accent', true);
          break;
        case 'kick':
          set_kick_state(id, action == 'off' ? 'off' : 'normal', true);
          break;
        case 'tom1':
          set_tom_state(id, 1, action == 'off' ? 'off' : 'normal', true);
          break;
        case 'tom2':
          set_tom_state(id, 2, action == 'off' ? 'off' : 'normal', true);
          break;
        case 'tom3':
          set_tom_state(id, 3, action == 'off' ? 'off' : 'normal', true);
          break;
        case 'tom4':
          set_tom_state(id, 4, action == 'off' ? 'off' : 'normal', true);
          break;
        case 'sticking':
          set_sticking_state(id, action == 'off' ? 'off' : 'right', true);
          break;
        default:
          console.log('Bad case in noteOnMouseEnter');
          break;
      }
      updateSheetMusic(); // update music
    }

    return false;
  };

  // --- Permutation engine (extracted to permutations.js) ---------------------
  // Thin wrappers preserving the original in-file API: they inject the current
  // usingTriplets() flag and delegate to the pure module functions.
  function get_permutation_pre_ABC(section, showTitle) {
    return _perm.get_permutation_pre_ABC(section, showTitle);
  }
  function get_permutation_post_ABC(section, isLast) {
    return _perm.get_permutation_post_ABC(section, usingTriplets(), isLast);
  }
  function get_kick16th_permutation_array(section) {
    return _perm.get_kick16th_permutation_array(section, usingTriplets());
  }
  function get_kick16th_permutation_array_minus_some(section) {
    return _perm.get_kick16th_permutation_array_minus_some(section, usingTriplets());
  }
  function get_snare_permutation_array(section) {
    return _perm.get_snare_permutation_array(section, usingTriplets());
  }
  function get_snare_accent_permutation_array(section) {
    return _perm.get_snare_accent_permutation_array(section, usingTriplets());
  }
  function get_snare_accent_with_diddle_permutation_array(section) {
    return _perm.get_snare_accent_with_diddle_permutation_array(section, usingTriplets());
  }
  function get_numSectionsFor_permutation_array() {
    return _perm.get_numSectionsFor_permutation_array();
  }

  // 16th note permutation array expressed in 32nd notes
  // some kicks are excluded at the beginning of the measure to make the groupings
  // easier to play through continuously

  // 16th note permutation array expressed in 32nd notes
  // all kicks are included, including the ones that start the measure

  // 48th note triplet kick permutation

  // create a new instance of an array with all the values prefilled with false
  // the array size is 32nd notes for the current time signature
  // 4/4 would be 32 notes
  // 5/4 would be 40 notes
  // 2/4 would be 16 notes
  // 4/2 would be 32 notes
  function get_empty_note_array_in_32nds() {
    var notes_per_4_beats = 32;
    if (usingTriplets()) notes_per_4_beats = 48;
    var num_notes =
      (class_num_beats_per_measure * notes_per_4_beats) / class_note_value_per_measure;

    return _grid.get_empty_note_array(num_notes);
  }

  // snare permutation

  // Snare permutation, with Accented permutation.   Snare hits every 16th note, accent moves

  // Snare permutation, with Accented and diddled permutation.   Accented notes are singles, non accents are diddled

  // use the Permutation options to figure out if we should display a particular section
  function shouldDisplayPermutationForSection(sectionNum) {
    var ret_val = false;

    switch (sectionNum) {
      case 0:
        if (
          document.getElementById('PermuationOptionsOstinato').checked &&
          (!document.getElementById('PermuationOptionsOstinato_sub1') ||
            document.getElementById('PermuationOptionsOstinato_sub1').checked)
        )
          ret_val = true;
        break;
      case 1:
        if (
          document.getElementById('PermuationOptionsSingles').checked &&
          document.getElementById('PermuationOptionsSingles_sub1').checked
        )
          ret_val = true;
        break;
      case 2:
        if (
          document.getElementById('PermuationOptionsSingles').checked &&
          document.getElementById('PermuationOptionsSingles_sub2').checked
        )
          ret_val = true;
        break;
      case 3:
        if (
          document.getElementById('PermuationOptionsSingles').checked &&
          document.getElementById('PermuationOptionsSingles_sub3').checked
        )
          ret_val = true;
        break;
      case 4:
        if (
          !usingTriplets() &&
          document.getElementById('PermuationOptionsSingles').checked &&
          document.getElementById('PermuationOptionsSingles_sub4').checked
        )
          ret_val = true;
        break;
      case 5:
        if (
          document.getElementById('PermuationOptionsDoubles').checked &&
          document.getElementById('PermuationOptionsDoubles_sub1').checked
        )
          ret_val = true;
        break;
      case 6:
        if (
          document.getElementById('PermuationOptionsDoubles').checked &&
          document.getElementById('PermuationOptionsDoubles_sub2').checked
        )
          ret_val = true;
        break;
      case 7:
        if (
          document.getElementById('PermuationOptionsDoubles').checked &&
          document.getElementById('PermuationOptionsDoubles_sub3').checked
        )
          ret_val = true;
        break;
      case 8:
        if (
          !usingTriplets() &&
          document.getElementById('PermuationOptionsDoubles').checked &&
          document.getElementById('PermuationOptionsDoubles_sub4').checked
        )
          ret_val = true;
        break;
      case 9:
        if (
          !usingTriplets() &&
          document.getElementById('PermuationOptionsUpsDowns').checked &&
          document.getElementById('PermuationOptionsUpsDowns_sub1').checked
        )
          ret_val = true;
        break;
      case 10:
        if (
          !usingTriplets() &&
          document.getElementById('PermuationOptionsUpsDowns').checked &&
          document.getElementById('PermuationOptionsUpsDowns_sub2').checked
        )
          ret_val = true;
        break;
      case 11:
        if (
          document.getElementById('PermuationOptionsTriples').checked &&
          (!document.getElementById('PermuationSubOptionsTriples1') ||
            document.getElementById('PermuationOptionsTriples_sub1').checked)
        )
          ret_val = true;
        break;
      case 12:
        if (
          !usingTriplets() &&
          document.getElementById('PermuationOptionsTriples').checked &&
          document.getElementById('PermuationOptionsTriples_sub2').checked
        )
          ret_val = true;
        break;
      case 13:
        if (
          !usingTriplets() &&
          document.getElementById('PermuationOptionsTriples').checked &&
          document.getElementById('PermuationOptionsTriples_sub3').checked
        )
          ret_val = true;
        break;
      case 14:
        if (
          !usingTriplets() &&
          document.getElementById('PermuationOptionsTriples').checked &&
          document.getElementById('PermuationOptionsTriples_sub4').checked
        )
          ret_val = true;
        break;
      case 15:
        if (
          !usingTriplets() &&
          document.getElementById('PermuationOptionsQuads').checked &&
          (!document.getElementById('PermuationOptionsQuads_sub1') ||
            document.getElementById('PermuationOptionsQuads_sub1').checked)
        )
          ret_val = true;
        break;
      default:
        console.log('bad case in groove_writer.js:shouldDisplayPermutationForSection()');
        return false;
      //break;
    }

    return ret_val;
  }

  // use the permutation options to count the number of active permutation sections
  function get_numberOfActivePermutationSections() {
    var max_num = get_numSectionsFor_permutation_array();
    var total_on = 0;

    for (var i = 0; i < max_num; i++) {
      if (shouldDisplayPermutationForSection(i)) total_on++;
    }

    return total_on;
  }

  // query the clickable UI and generate a 32 element array representing the notes of one measure
  // note: the ui may have fewer notes, but we scale them to fit into the 32 elements proportionally
  // If using triplets returns 48 notes.   Otherwise always 32.
  //
  // (note: Only one measure, not all the notes on the page if multiple measures are present)
  // Return value is the number of notes.
  // Read one measure of the clickable grid into the passed-in arrays. Thin
  // wrapper: threads GrooveWriter's layout + row-visibility state into the
  // extracted gridState reader.
  function get32NoteArrayFromClickableUI(
    Sticking_Array,
    HH_Array,
    Snare_Array,
    Kick_Array,
    Toms_Array,
    startIndexForClickableUI
  ) {
    return _grid.get32NoteArrayFromClickableUI(
      Sticking_Array,
      HH_Array,
      Snare_Array,
      Kick_Array,
      Toms_Array,
      startIndexForClickableUI,
      {
        notesPerMeasure: class_notes_per_measure,
        numBeatsPerMeasure: class_num_beats_per_measure,
        noteValuePerMeasure: class_note_value_per_measure,
        stickingsVisible: isStickingsVisible(),
        tomsVisible: isTomsVisible(),
      }
    );
  }

  // each of the instruments can be muted.   Check the UI and zero out the array if the instrument is marked as muted
  // for a particular measure
  function muteArrayFromClickableUI(
    Sticking_Array,
    HH_Array,
    Snare_Array,
    Kick_Array,
    Toms_Array,
    measureIndex
  ) {
    return _grid.muteArrayFromClickableUI(
      Sticking_Array,
      HH_Array,
      Snare_Array,
      Kick_Array,
      Toms_Array,
      measureIndex,
      isInstrumentMuted
    );
  }

  function createMidiUrlFromClickableUI(MIDI_type) {
    var Sticking_Array = get_empty_note_array_in_32nds();
    var HH_Array = get_empty_note_array_in_32nds();
    var Snare_Array = get_empty_note_array_in_32nds();
    var Kick_Array = get_empty_note_array_in_32nds();
    var Toms_Array = [
      get_empty_note_array_in_32nds(),
      get_empty_note_array_in_32nds(),
      get_empty_note_array_in_32nds(),
      get_empty_note_array_in_32nds(),
    ];

    var i,
      new_snare_array,
      num_notes_for_swing = 16;

    var metronomeFrequency = root.getMetronomeFrequency();

    // just the first measure
    var num_notes = get32NoteArrayFromClickableUI(
      Sticking_Array,
      HH_Array,
      Snare_Array,
      Kick_Array,
      Toms_Array,
      0
    );
    muteArrayFromClickableUI(Sticking_Array, HH_Array, Snare_Array, Kick_Array, Toms_Array, 0);

    var midiFile = new Midi.File();
    var midiTrack = new Midi.Track();
    midiFile.addTrack(midiTrack);

    midiTrack.setTempo(root.myGrooveUtils.getTempo());
    midiTrack.setInstrument(0, 0x13);

    var swing_percentage = root.myGrooveUtils.getSwing() / 100;

    // all of the permutations use just the first measure
    switch (class_permutation_type) {
      case 'kick_16ths':
        var numSections = get_numSectionsFor_permutation_array();

        // compute sections with different kick patterns
        for (i = 0; i < numSections; i++) {
          if (shouldDisplayPermutationForSection(i)) {
            var new_kick_array;

            if (
              document.getElementById('PermuationOptionsSkipSomeFirstNotes') &&
              document.getElementById('PermuationOptionsSkipSomeFirstNotes').checked
            )
              new_kick_array = get_kick16th_permutation_array_minus_some(i);
            else new_kick_array = get_kick16th_permutation_array(i);

            // grab hi-hat foots from existing kick array and merge it in.
            Kick_Array = _perm.filter_kick_array_for_permutation(Kick_Array);
            new_kick_array = _perm.merge_kick_arrays(new_kick_array, Kick_Array);

            root.myGrooveUtils.MIDI_from_HH_Snare_Kick_Arrays(
              midiTrack,
              HH_Array,
              Snare_Array,
              new_kick_array,
              Toms_Array,
              MIDI_type,
              metronomeFrequency,
              num_notes,
              num_notes_for_swing,
              swing_percentage,
              class_num_beats_per_measure,
              class_note_value_per_measure
            );
          }
        }
        break;

      case 'snare_16ths': // use the hh & snare from the user
        numSections = get_numSectionsFor_permutation_array();

        //compute sections with different snare patterns
        for (i = 0; i < numSections; i++) {
          if (shouldDisplayPermutationForSection(i)) {
            if (
              document.getElementById('PermuationOptionsAccentGridDiddled') &&
              document.getElementById('PermuationOptionsAccentGridDiddled').checked
            )
              new_snare_array = get_snare_accent_with_diddle_permutation_array(i);
            else if (
              document.getElementById('PermuationOptionsAccentGrid') &&
              document.getElementById('PermuationOptionsAccentGrid').checked
            )
              new_snare_array = get_snare_accent_permutation_array(i);
            else new_snare_array = get_snare_permutation_array(i);

            root.myGrooveUtils.MIDI_from_HH_Snare_Kick_Arrays(
              midiTrack,
              HH_Array,
              new_snare_array,
              Kick_Array,
              Toms_Array,
              MIDI_type,
              metronomeFrequency,
              num_notes,
              num_notes_for_swing,
              swing_percentage,
              class_num_beats_per_measure,
              class_note_value_per_measure
            );
          }
        }
        break;

      case 'none':
      /* falls through */
      default:
        if (class_time_division < 16)
          num_notes_for_swing = (8 * class_num_beats_per_measure) / class_note_value_per_measure;
        else
          num_notes_for_swing = (16 * class_num_beats_per_measure) / class_note_value_per_measure;

        // Ben: play only the selected bars (loop / play-from), each cut to its own meter
        class_play_timeline = [];
        barsToPlay(MIDI_type == 'our_MIDI').forEach(function (barIndex) {
          Sticking_Array = get_empty_note_array_in_32nds();
          HH_Array = get_empty_note_array_in_32nds();
          Snare_Array = get_empty_note_array_in_32nds();
          Kick_Array = get_empty_note_array_in_32nds();
          Toms_Array = [
            get_empty_note_array_in_32nds(),
            get_empty_note_array_in_32nds(),
            get_empty_note_array_in_32nds(),
            get_empty_note_array_in_32nds(),
          ];
          get32NoteArrayFromClickableUI(
            Sticking_Array,
            HH_Array,
            Snare_Array,
            Kick_Array,
            Toms_Array,
            class_notes_per_measure * barIndex
          );
          muteArrayFromClickableUI(
            Sticking_Array,
            HH_Array,
            Snare_Array,
            Kick_Array,
            Toms_Array,
            barIndex
          );
          var meter = meterFor(barIndex);
          var len = Math.round(num_notes * barFrac(barIndex));
          var cut = (arr) => arr.slice(0, len);
          class_play_timeline.push({ bar: barIndex, slots: len });
          root.myGrooveUtils.MIDI_from_HH_Snare_Kick_Arrays(
            midiTrack,
            cut(HH_Array),
            cut(Snare_Array),
            cut(Kick_Array),
            Toms_Array.map(cut),
            MIDI_type,
            metronomeFrequency,
            len,
            (num_notes_for_swing * len) / num_notes,
            swing_percentage,
            meter[0],
            meter[1]
          );
        });
        break;
    }

    var midi_url = 'data:audio/midi;base64,' + btoa(midiFile.toBytes());

    return midi_url;
  }

  root.MIDISaveAs = function () {
    var midi_url = createMidiUrlFromClickableUI('general_MIDI');

    // save as
    document.location = midi_url;
  };

  // creates a grooveData class from the clickable UI elements of the page
  //
  root.grooveDataFromClickableUI = function () {
    var myGrooveData = new root.myGrooveUtils.grooveDataNew();

    myGrooveData.notesPerMeasure = class_notes_per_measure;
    myGrooveData.timeDivision = class_time_division;
    myGrooveData.numberOfMeasures = class_number_of_measures;
    myGrooveData.measureMeters = metersArrayOrNull();
    myGrooveData.numBeats = class_num_beats_per_measure;
    myGrooveData.noteValue = class_note_value_per_measure;
    myGrooveData.showStickings = isStickingsVisible();
    myGrooveData.showToms = isTomsVisible();
    myGrooveData.title = document.getElementById('tuneTitle').value;
    myGrooveData.author = document.getElementById('tuneAuthor').value;
    myGrooveData.comments = document.getElementById('tuneComments').value;
    myGrooveData.showLegend = document.getElementById('showLegend').checked;
    myGrooveData.swingPercent = root.myGrooveUtils.getSwing();
    myGrooveData.tempo = root.myGrooveUtils.getTempo();
    myGrooveData.metronomeFrequency = root.getMetronomeFrequency();
    myGrooveData.kickStemsUp = true;

    for (var i = 0; i < class_number_of_measures; i++) {
      var total_notes = class_notes_per_measure * class_number_of_measures;
      myGrooveData.sticking_array = [];
      myGrooveData.hh_array = [];
      myGrooveData.snare_array = [];
      myGrooveData.kick_array = [];
      myGrooveData.toms_array = [[], [], [], []];

      // query the clickable UI and generate a arrays representing the notes of all measures
      for (i = 0; i < total_notes; i++) {
        // only grab the stickings if they are visible
        if (isStickingsVisible()) myGrooveData.sticking_array.push(get_sticking_state(i, 'ABC'));

        myGrooveData.hh_array.push(get_hh_state(i, 'ABC'));
        myGrooveData.snare_array.push(get_snare_state(i, 'ABC'));
        myGrooveData.kick_array.push(get_kick_state(i, 'ABC'));

        if (isTomsVisible()) {
          myGrooveData.toms_array[0].push(get_tom_state(i, 1, 'ABC'));
          myGrooveData.toms_array[1].push(get_tom_state(i, 2, 'ABC'));
          myGrooveData.toms_array[2].push(get_tom_state(i, 3, 'ABC'));
          myGrooveData.toms_array[3].push(get_tom_state(i, 4, 'ABC'));
        } else {
          myGrooveData.toms_array[0].push(false);
          myGrooveData.toms_array[1].push(false);
          myGrooveData.toms_array[2].push(false);
          myGrooveData.toms_array[3].push(false);
        }
      }
    }

    return myGrooveData;
  };

  // called by the HTML when changes happen to forms that require the ABC to update
  root.refresh_ABC = function () {
    updateSheetMusic();
  };

  // Want to create something like this:
  //
  // {{GrooveTab
  // |HasTempo=90
  // |HasSwingPercent=0
  // |HasDivision=16
  // |HasMeasures=2
  // |HasNotesPerMeasure=32
  // |HasTimeSignature=4/4
  // |HasHiHatTab=x---o---+---x---x---o---+---x---x---o---+---x---x---o---+---x---
  // |HasSnareAccentTab=--------O-------------------O-----------O---------------O-------
  // |HasSnareOtherTab=--------------g-------------------g-----------g-----------------
  // |HasKickTab=o---------------o---o---------------o-----------o---o---------o-
  // |HasFootOtherTab=----------------------------------------------------------------
  // |HasTom1Tab=--------------------------------------------------------o-------
  // |HasTom4Tab=----------------o---------------------------------------o-------
  // |HasEditData=?GDB_Author=1&TimeSig=4/4&Div=32&Tempo=80&Measures=2&H=|--x-----x---x-------------------|--x-----x---x-------------------|&S=|----g-----g-------------ooo-o-o-|----g-----g-----------------gggg|&K=|o-----x-------o-o---------------|o-----x-------o-o---------------|&T1=|--------------------------------|------------------------x-------|&T4=|----------------x---------------|------------------------x-------|
  // }}
  //
  root.updateGrooveDBSource = function () {
    if (
      !document.getElementById('GrooveDB_source') ||
      document.getElementById('GrooveDB_source').style.display == 'none'
    )
      return; // nothing to update

    var myGrooveData = root.grooveDataFromClickableUI();

    var notesPerMeasureInTab = root.myGrooveUtils.calc_notes_per_measure(
      usingTriplets() ? 48 : 32,
      class_num_beats_per_measure,
      class_note_value_per_measure
    );
    var maxNotesInTab = myGrooveData.numberOfMeasures * notesPerMeasureInTab;

    // scale up all the arrays to 48 or 32 notes so that they look normalized

    myGrooveData.hh_array = root.myGrooveUtils.scaleNoteArrayToFullSize(
      myGrooveData.hh_array,
      myGrooveData.numberOfMeasures,
      myGrooveData.notesPerMeasure,
      myGrooveData.numBeats,
      myGrooveData.noteValue
    );
    myGrooveData.snare_array = root.myGrooveUtils.scaleNoteArrayToFullSize(
      myGrooveData.snare_array,
      myGrooveData.numberOfMeasures,
      myGrooveData.notesPerMeasure,
      myGrooveData.numBeats,
      myGrooveData.noteValue
    );
    myGrooveData.kick_array = root.myGrooveUtils.scaleNoteArrayToFullSize(
      myGrooveData.kick_array,
      myGrooveData.numberOfMeasures,
      myGrooveData.notesPerMeasure,
      myGrooveData.numBeats,
      myGrooveData.noteValue
    );
    myGrooveData.toms_array[0] = root.myGrooveUtils.scaleNoteArrayToFullSize(
      myGrooveData.toms_array[0],
      myGrooveData.numberOfMeasures,
      myGrooveData.notesPerMeasure,
      myGrooveData.numBeats,
      myGrooveData.noteValue
    );
    myGrooveData.toms_array[3] = root.myGrooveUtils.scaleNoteArrayToFullSize(
      myGrooveData.toms_array[3],
      myGrooveData.numberOfMeasures,
      myGrooveData.notesPerMeasure,
      myGrooveData.numBeats,
      myGrooveData.noteValue
    );

    var DBString = '{{GrooveTab';

    DBString += '\n|HasTempo=' + myGrooveData.tempo;
    DBString += '\n|HasSwingPercent=' + myGrooveData.swingPercent;
    DBString += '\n|HasDivision=' + myGrooveData.notesPerMeasure;
    DBString += '\n|HasMeasures=' + myGrooveData.numberOfMeasures;
    DBString += '\n|HasNotesPerMeasure=' + notesPerMeasureInTab;
    DBString += '\n|HasTimeSignature=' + myGrooveData.numBeats + '/' + myGrooveData.noteValue;
    DBString +=
      '\n|HasHiHatTab=' +
      root.myGrooveUtils.tabLineFromAbcNoteArray(
        'H',
        myGrooveData.hh_array,
        true,
        true,
        maxNotesInTab,
        0
      );
    DBString +=
      '\n|HasSnareAccentTab=' +
      root.myGrooveUtils.tabLineFromAbcNoteArray(
        'S',
        myGrooveData.snare_array,
        true,
        false,
        maxNotesInTab,
        0
      );
    DBString +=
      '\n|HasSnareOtherTab=' +
      root.myGrooveUtils.tabLineFromAbcNoteArray(
        'S',
        myGrooveData.snare_array,
        false,
        true,
        maxNotesInTab,
        0
      );
    DBString +=
      '\n|HasKickTab=' +
      root.myGrooveUtils.tabLineFromAbcNoteArray(
        'K',
        myGrooveData.kick_array,
        true,
        false,
        maxNotesInTab,
        0
      );
    DBString +=
      '\n|HasFootOtherTab=' +
      root.myGrooveUtils.tabLineFromAbcNoteArray(
        'K',
        myGrooveData.kick_array,
        false,
        true,
        maxNotesInTab,
        0
      );
    DBString +=
      '\n|HasTom1Tab=' +
      root.myGrooveUtils.tabLineFromAbcNoteArray(
        'T1',
        myGrooveData.toms_array[0],
        false,
        true,
        maxNotesInTab,
        0
      );
    DBString +=
      '\n|HasTom4Tab=' +
      root.myGrooveUtils.tabLineFromAbcNoteArray(
        'T4',
        myGrooveData.toms_array[3],
        false,
        true,
        maxNotesInTab,
        0
      );
    DBString += '\n|HasEditData=' + class_undo_stack[class_undo_stack.length - 1];

    DBString += '\n}}';

    document.getElementById('GrooveDB_source').value = DBString;
  };

  root.undoCommand = function () {
    if (class_undo_stack.length > 1) {
      var undoURL = class_undo_stack.pop();
      root.AddItemToUndoOrRedoStack(undoURL, class_redo_stack); // add to redo stack
      // the one we want to load is behind the head, since all changes go on the undo stack immediately
      // no need to pop, since it would just get added right back on anyways
      undoURL = class_undo_stack[class_undo_stack.length - 1];
      set_Default_notes(undoURL);
    }
  };

  root.redoCommand = function () {
    if (class_redo_stack.length > 0) {
      var redoURL = class_redo_stack.pop();
      root.AddItemToUndoOrRedoStack(redoURL, class_undo_stack); // add to undo stack
      set_Default_notes(redoURL);
    }
  };

  // push the new URL on the undo or redo stack
  // keep the stacks at a managable size
  root.AddItemToUndoOrRedoStack = function (newURL, ourStack, noClear) {
    if (!ourStack) return false;

    if (newURL == class_undo_stack[class_undo_stack.length - 1]) {
      //debugPrintUndoRedoStack();
      return false; // no change, so don't push
    }

    ourStack.push(newURL);
    while (ourStack.length > constant_undo_stack_max_size) ourStack.shift();

    //debugPrintUndoRedoStack();

    return true;
  };

  root.AddFullURLToUndoStack = function (fullURL) {
    var urlFragment;

    var searchData = fullURL.indexOf('?');

    urlFragment = fullURL.slice(searchData);

    // clear redo array whenever we add a new valid element to the stack
    // when we undo, we end up with a null push that returns false here
    if (root.AddItemToUndoOrRedoStack(urlFragment, class_undo_stack)) {
      class_redo_stack = [];
    }
  };

  // update the current URL so that reloads and history traversal and link shares and bookmarks work correctly
  root.updateCurrentURL = function () {
    var newURL = get_FullURLForPage();
    var newTitle = false;

    root.AddFullURLToUndoStack(newURL);

    var title = document.getElementById('tuneTitle').value.trim();
    if (title !== '') newTitle = title;

    var author = document.getElementById('tuneAuthor').value.trim();
    if (author !== '') {
      if (title) newTitle += ' by ' + author;
      else newTitle = 'Groove by ' + author;
    }

    if (!newTitle) newTitle = class_app_title;

    document.title = newTitle;
    try {
      window.history.replaceState(null, newTitle, newURL);
    } catch (err) {
      /* empty */
    }

    if (root.myGrooveUtils.debugMode) {
      // put the search data on the bottom of the page to make it easy to cut & paste
      var searchDataEle = document.getElementById('URLSearchData');
      if (searchDataEle) {
        var searchIndex = newURL.indexOf('?');
        var searchURL = newURL.substring(searchIndex).replace('Debug=1&', '');
        searchDataEle.innerHTML = '<p style="margin-left: 10px;"><b>' + searchURL + '</b><p>';
      }
    }
  };

  function generate_ABC(renderWidth) {
    var Sticking_Array = get_empty_note_array_in_32nds();
    var HH_Array = get_empty_note_array_in_32nds();
    var Snare_Array = get_empty_note_array_in_32nds();
    var Kick_Array = get_empty_note_array_in_32nds();
    var Toms_Array = [
      get_empty_note_array_in_32nds(),
      get_empty_note_array_in_32nds(),
      get_empty_note_array_in_32nds(),
      get_empty_note_array_in_32nds(),
    ];
    var numSections = get_numSectionsFor_permutation_array();
    var i, new_snare_array, post_abc;
    var num_notes = get32NoteArrayFromClickableUI(
      Sticking_Array,
      HH_Array,
      Snare_Array,
      Kick_Array,
      Toms_Array,
      0
    );

    // abc header boilerplate
    var tuneTitle = document.getElementById('tuneTitle').value;
    var tuneAuthor = document.getElementById('tuneAuthor').value;
    var tuneComments = document.getElementById('tuneComments').value;
    var showLegend = document.getElementById('showLegend').checked;
    root.myGrooveUtils.isLegendVisable = showLegend;

    var fullABC = '';

    switch (class_permutation_type) {
      case 'kick_16ths': // use the hh & snare from the user
        numSections = get_numSectionsFor_permutation_array();

        fullABC = root.myGrooveUtils.get_top_ABC_BoilerPlate(
          class_permutation_type != 'none',
          tuneTitle,
          tuneAuthor,
          tuneComments,
          showLegend,
          usingTriplets(),
          false,
          class_num_beats_per_measure,
          class_note_value_per_measure,
          renderWidth
        );
        root.myGrooveUtils.note_mapping_array = [];

        // compute sections with different kick patterns
        for (i = 0; i < numSections; i++) {
          if (shouldDisplayPermutationForSection(i)) {
            var new_kick_array;

            if (
              document.getElementById('PermuationOptionsSkipSomeFirstNotes') &&
              document.getElementById('PermuationOptionsSkipSomeFirstNotes').checked
            )
              new_kick_array = get_kick16th_permutation_array_minus_some(i);
            else new_kick_array = get_kick16th_permutation_array(i);

            // grab hi-hat foots from existing kick array and merge it in.
            Kick_Array = _perm.filter_kick_array_for_permutation(Kick_Array);
            new_kick_array = _perm.merge_kick_arrays(new_kick_array, Kick_Array);

            var flags = _perm.get_permutation_display_flags(i, shouldDisplayPermutationForSection);
            post_abc = get_permutation_post_ABC(i, flags.isLast);

            fullABC += get_permutation_pre_ABC(i, flags.showTitle);
            fullABC += root.myGrooveUtils.create_ABC_from_snare_HH_kick_arrays(
              Sticking_Array,
              HH_Array,
              Snare_Array,
              new_kick_array,
              Toms_Array,
              post_abc,
              num_notes,
              class_time_division,
              num_notes,
              true,
              class_num_beats_per_measure,
              class_note_value_per_measure
            );
            root.myGrooveUtils.note_mapping_array = root.myGrooveUtils.note_mapping_array.concat(
              root.myGrooveUtils.create_note_mapping_array_for_highlighting(
                HH_Array,
                Snare_Array,
                new_kick_array,
                Toms_Array,
                num_notes
              )
            );
          }
        }
        break;

      case 'snare_16ths': // use the hh & kick from the user
        numSections = get_numSectionsFor_permutation_array();

        fullABC = root.myGrooveUtils.get_top_ABC_BoilerPlate(
          class_permutation_type != 'none',
          tuneTitle,
          tuneAuthor,
          tuneComments,
          showLegend,
          usingTriplets(),
          false,
          class_num_beats_per_measure,
          class_note_value_per_measure,
          renderWidth
        );
        root.myGrooveUtils.note_mapping_array = [];

        //compute 16 sections with different snare patterns
        for (i = 0; i < numSections; i++) {
          if (shouldDisplayPermutationForSection(i)) {
            if (
              document.getElementById('PermuationOptionsAccentGridDiddled') &&
              document.getElementById('PermuationOptionsAccentGridDiddled').checked
            )
              new_snare_array = get_snare_accent_with_diddle_permutation_array(i);
            else if (
              document.getElementById('PermuationOptionsAccentGrid') &&
              document.getElementById('PermuationOptionsAccentGrid').checked
            )
              new_snare_array = get_snare_accent_permutation_array(i);
            else new_snare_array = get_snare_permutation_array(i);

            flags = _perm.get_permutation_display_flags(i, shouldDisplayPermutationForSection);
            post_abc = get_permutation_post_ABC(i, flags.isLast);

            fullABC += get_permutation_pre_ABC(i, flags.showTitle);
            fullABC += root.myGrooveUtils.create_ABC_from_snare_HH_kick_arrays(
              Sticking_Array,
              HH_Array,
              new_snare_array,
              Kick_Array,
              Toms_Array,
              post_abc,
              num_notes,
              class_time_division,
              num_notes,
              true,
              class_num_beats_per_measure,
              class_note_value_per_measure
            );
            root.myGrooveUtils.note_mapping_array = root.myGrooveUtils.note_mapping_array.concat(
              root.myGrooveUtils.create_note_mapping_array_for_highlighting(
                HH_Array,
                new_snare_array,
                Kick_Array,
                Toms_Array,
                num_notes
              )
            );
          }
        }
        break;

      case 'none':
      /* falls through */
      default:
        fullABC = root.myGrooveUtils.get_top_ABC_BoilerPlate(
          class_permutation_type != 'none',
          tuneTitle,
          tuneAuthor,
          tuneComments,
          showLegend,
          usingTriplets(),
          true,
          meterFor(0)[0],
          meterFor(0)[1],
          renderWidth
        );
        // Ben: bar numbers above every bar
        fullABC = fullABC.replace('%%stretchlast', '%%measurenb 1\n%%measurefont calibri 11\n%%stretchlast');
        root.myGrooveUtils.note_mapping_array = [];
        class_bar_map_start = [];
        var prevMeter = meterFor(0).join('/');

        var numberOfMeasuresPerLine = sheetBarsPerLine();
        var addon_abc;
        // Ben: full lines fill the width; only a short last line (fewer bars than the others)
        // keeps its natural proportions instead of being stretched flat
        if (class_number_of_measures % numberOfMeasuresPerLine !== 0)
          fullABC = fullABC.replace('%%stretchlast 1', '%%stretchlast 0');

        for (i = 0; i < class_number_of_measures; i++) {
          // we already go the array states above, don't get it again.
          if (i > 0) {
            // reset arrays
            Sticking_Array = get_empty_note_array_in_32nds();
            HH_Array = get_empty_note_array_in_32nds();
            Snare_Array = get_empty_note_array_in_32nds();
            Kick_Array = get_empty_note_array_in_32nds();
            Toms_Array = [
              get_empty_note_array_in_32nds(),
              get_empty_note_array_in_32nds(),
              get_empty_note_array_in_32nds(),
              get_empty_note_array_in_32nds(),
            ];

            get32NoteArrayFromClickableUI(
              Sticking_Array,
              HH_Array,
              Snare_Array,
              Kick_Array,
              Toms_Array,
              class_notes_per_measure * i
            );
          }

          if (i + 1 == class_number_of_measures) {
            // last measure
            addon_abc = '|\n';
          } else if ((i + 1) % numberOfMeasuresPerLine === 0) {
            // new line measure
            addon_abc = '\n';
          } else {
            // continuation measure
            addon_abc = '\\\n';
          }
          // Ben: this bar has its own meter and may be shorter than the base measure
          var barMeter = meterFor(i);
          var barLen = Math.round(num_notes * barFrac(i));
          var cutBar = (arr) => arr.slice(0, barLen);
          var barABC = root.myGrooveUtils.create_ABC_from_snare_HH_kick_arrays(
            cutBar(Sticking_Array),
            cutBar(HH_Array),
            cutBar(Snare_Array),
            cutBar(Kick_Array),
            Toms_Array.map(cutBar),
            addon_abc,
            barLen,
            class_time_division,
            barLen,
            true,
            barMeter[0],
            barMeter[1]
          );
          if (barMeter.join('/') != prevMeter) barABC = addInlineMeter(barABC, barMeter[0], barMeter[1]);
          prevMeter = barMeter.join('/');
          fullABC += barABC;
          class_bar_map_start[i] = root.myGrooveUtils.note_mapping_array.length;
          root.myGrooveUtils.note_mapping_array = root.myGrooveUtils.note_mapping_array.concat(
            root.myGrooveUtils.create_note_mapping_array_for_highlighting(
              cutBar(HH_Array),
              cutBar(Snare_Array),
              cutBar(Kick_Array),
              Toms_Array.map(cutBar),
              barLen
            )
          );
        }

        break;
    }

    return fullABC;
  }

  // this is called by a bunch of places anytime we modify the musical notes on the page
  // this will recreate the ABC code and will then use the ABC to rerender the sheet music
  // on the page.
  // Ben: bars per line: user setting, else by screen width (print: 2)
  function sheetBarsPerLine() {
    var setting = getBarsPerLineSetting();
    if (setting) return setting;
    if (root._benPrintLayout) return 2;
    var sheetW = (document.getElementById('svgTarget') || {}).offsetWidth || 1000;
    if (benPopupOpen()) sheetW = benPop.innerWidth - 40;
    return Math.max(1, Math.round(sheetW / (class_notes_per_measure >= 32 ? 1100 : 760)));
  }

  function updateSheetMusic() {
    var renderWidth = 600;
    var svgTarget = document.getElementById('svgTarget');
    if (svgTarget) {
      renderWidth = svgTarget.offsetWidth - 100;
      renderWidth = Math.floor(renderWidth * 0.6); // reduce width by 20% (This actually makes the notes bigger, because we scale up everything to max width)
    }
    // Ben: give every bar a fixed amount of room, so bars keep the same proportions however
    // wide the screen is (no more flat, stretched bars). The SVG is scaled up to the screen.
    if (class_permutation_type == 'none') {
      var perBar = class_notes_per_measure >= 32 ? 560 : 330;
      renderWidth = sheetBarsPerLine() * perBar + 40;
    }

    var fullABC = generate_ABC(renderWidth);

    document.getElementById('ABCsource').value = fullABC;
    root.updateGrooveDBSource();

    root.myGrooveUtils.midiNoteHasChanged(); // pretty likely the case

    // update the current URL so that reloads and history traversal and link shares and bookmarks work correctly
    root.updateCurrentURL();

    root.displayNewSVG();
  }

  // called by generate_ABC to remake the sheet music on the page
  root.displayNewSVG = function () {
    var svgTarget = document.getElementById('svgTarget'),
      diverr = document.getElementById('diverr');

    var abc_source = document.getElementById('ABCsource').value;
    var svg_return = root.myGrooveUtils.renderABCtoSVG(abc_source);

    diverr.innerHTML = svg_return.error_html;
    svgTarget.innerHTML = svg_return.svg;
    renderSheetOverlay();
    renderRideRows();
    mirrorSheetToPopup();
  };

  // Render an SVG that is good for download.
  // Constant size at 2000x200
  function downloadImages(imageType) {
    var abc_source = generate_ABC(800);
    var svg_obj = root.myGrooveUtils.renderABCtoSVG(abc_source);
    var filename;
    var tune_title = document.getElementById('tuneTitle').value;

    if (tune_title.length == 0) {
      filename = 'notation.';
    } else {
      filename = tune_title;
    }
    filename += imageType;

    var svg_images = svg_obj.svg.split('</svg>');
    // that split should always create at least 2 since it will match that </svg> if there is only one
    // since the split creates an extra one reduce the length by 1
    for (var i = 0; i < svg_images.length - 1; i++) {
      var myPablo = Pablo(svg_images[i] + '</svg>');
      var width = parseFloat(myPablo.attr('width'));
      var height = parseFloat(myPablo.attr('height'));
      var imageRatio = height / width;
      var newWidth = 2000;
      var newHeight = Math.round(newWidth * imageRatio);
      var newBoxWidth = Math.round(newWidth * 0.8);
      var newBoxHeight = Math.round(newHeight * 0.8);
      myPablo.attr('width', newWidth + 'px');
      myPablo.attr('height', newHeight + 'px');
      myPablo.attr('viewBox', '0 0 ' + newBoxWidth + ' ' + newBoxHeight);
      myPablo.children('g').attr('transform', 'scale(2)');

      myPablo.download(imageType, filename, function (result) {
        if (result.error) {
          alert('An error occurred when trying to convert the sheet music to a PNG file.');
        }
      });
    }
  }

  root.PNGSaveAs = function () {
    Pablo.support.image.png(function (acceptable) {
      if (acceptable) {
        downloadImages('png');
      } else {
        alert("Sorry, this browser can't export PNG images");
      }
    });
  };

  root.SVGSaveAs = function () {
    downloadImages('svg');
  };

  root.ShowHideABCResults = function () {
    var ABCResults = document.getElementById('ABC_Results');

    if (ABCResults.style.display == 'block') ABCResults.style.display = 'none';
    else ABCResults.style.display = 'block';

    return false; // don't follow the link
  };

  // remove a measure from the page
  // measureNum is indexed starting at 1, not 0
  root.closeMeasureButtonClick = function (measureNum) {
    var uiStickings = '';
    var uiHH = '';
    var uiTom1 = '';
    var uiTom2 = '';
    var uiTom3 = '';
    var uiTom4 = '';
    var uiSnare = '';
    var uiKick = '';

    // get the encoded notes out of the UI.
    // run through all the measure, but don't include the one that we are deleting
    var topIndex = class_notes_per_measure * class_number_of_measures;
    for (var i = 0; i < topIndex; i++) {
      // skip the range we are deleting
      if (
        i < (measureNum - 1) * class_notes_per_measure ||
        i >= measureNum * class_notes_per_measure
      ) {
        uiStickings += get_sticking_state(i, 'URL');
        uiHH += get_hh_state(i, 'URL');
        uiTom1 += get_tom_state(i, 1, 'URL');
        uiTom2 += get_tom_state(i, 2, 'URL');
        uiTom3 += get_tom_state(i, 3, 'URL');
        uiTom4 += get_tom_state(i, 4, 'URL');
        uiSnare += get_snare_state(i, 'URL');
        uiKick += get_kick_state(i, 'URL');
      }
    }

    class_number_of_measures--;

    root.expandAuthoringViewWhenNecessary(class_notes_per_measure, class_number_of_measures);

    changeDivisionWithNotes(
      class_time_division,
      uiStickings,
      uiHH,
      uiTom1,
      uiTom4,
      uiSnare,
      uiKick,
      uiTom2,
      uiTom3
    );

    updateSheetMusic();
  };

  // add a measure to the page
  // currently always at the end of the measures
  // copy the notes from the last measure to the new measure
  root.addMeasureButtonClick = function (event) {
    var uiStickings = '';
    var uiHH = '';
    var uiTom1 = '';
    var uiTom2 = '';
    var uiTom3 = '';
    var uiTom4 = '';
    var uiSnare = '';
    var uiKick = '';
    var i;

    // get the encoded notes out of the UI.
    var topIndex = class_notes_per_measure * class_number_of_measures;
    for (i = 0; i < topIndex; i++) {
      uiStickings += get_sticking_state(i, 'URL');
      uiHH += get_hh_state(i, 'URL');
      uiTom1 += get_tom_state(i, 1, 'URL');
      uiTom2 += get_tom_state(i, 2, 'URL');
      uiTom3 += get_tom_state(i, 3, 'URL');
      uiTom4 += get_tom_state(i, 4, 'URL');
      uiSnare += get_snare_state(i, 'URL');
      uiKick += get_kick_state(i, 'URL');
    }

    // run the the last measure twice to default in some notes
    for (i = topIndex - class_notes_per_measure; i < topIndex; i++) {
      uiStickings += get_sticking_state(i, 'URL');
      uiHH += get_hh_state(i, 'URL');
      uiTom1 += get_tom_state(i, 1, 'URL');
      uiTom2 += get_tom_state(i, 2, 'URL');
      uiTom3 += get_tom_state(i, 3, 'URL');
      uiTom4 += get_tom_state(i, 4, 'URL');
      uiSnare += get_snare_state(i, 'URL');
      uiKick += get_kick_state(i, 'URL');
    }

    class_number_of_measures++;

    root.expandAuthoringViewWhenNecessary(class_notes_per_measure, class_number_of_measures);

    changeDivisionWithNotes(
      class_time_division,
      uiStickings,
      uiHH,
      uiTom1,
      uiTom4,
      uiSnare,
      uiKick,
      uiTom2,
      uiTom3
    );

    // reference the button and scroll it into view
    var add_measure_button = document.getElementById('addMeasureButton');
    if (add_measure_button)
      add_measure_button.scrollIntoView({ block: 'start', behavior: 'smooth' });

    updateSheetMusic();

    if (class_number_of_measures === 5)
      window.alert(
        'Please be aware that the Groove Scribe is not designed to write an entire musical score.\n' +
          'You can create as many measures as you want, but your browser may slow down as more measures are added.\n' +
          'There are also many notation features that would be useful for score writing that are not part of Groove Scribe'
      );
  };

  function showHideCSS_ClassDisplay(className, force, showElseHide, showState) {
    var myElements = document.querySelectorAll(className);
    var newStateIsOn = true;

    for (var i = 0; i < myElements.length; i++) {
      var element = myElements[i];

      if (force) {
        newStateIsOn = showElseHide;
      } else {
        // no-force means to swap on each call
        if (element.style.display == showState) newStateIsOn = false;
        else newStateIsOn = true;
      }

      if (newStateIsOn) element.style.display = showState;
      else element.style.display = 'none';
    }

    return newStateIsOn;
  }

  function showHideCSS_ClassVisibility(className, force, showElseHide) {
    var myElements = document.querySelectorAll(className);
    for (var i = 0; i < myElements.length; i++) {
      var stickings = myElements[i];

      if (force) {
        if (showElseHide) stickings.style.visibility = 'visible';
        else stickings.style.visibility = 'hidden';
      } else {
        // no-force means to swap on each call
        if (stickings.style.visibility == 'visible') stickings.style.visibility = 'hidden';
        else stickings.style.visibility = 'visible';
      }
    }
  }

  // clear all the notes on all measures
  root.clearAllNotes = function () {
    for (var i = 0; i < class_number_of_measures * class_notes_per_measure; i++) {
      set_sticking_state(i, 'off');
      set_hh_state(i, 'off');
      set_tom1_state(i, 'off');
      set_tom2_state(i, 'off');
      set_tom3_state(i, 'off');
      set_tom4_state(i, 'off');
      set_snare_state(i, 'off');
      set_kick_state(i, 'off');
    }
    updateSheetMusic();
  };

  function isTomsVisible() {
    var myElements = document.querySelectorAll('.toms-container');
    for (var i = 0; i < myElements.length; i++) {
      if (myElements[i].style.visibility == 'visible') return true;
    }

    return false;
  }

  root.showHideToms = function (force, showElseHide, dontRefreshScreen) {
    var OnElseOff = showHideCSS_ClassVisibility('.toms-container', force, showElseHide);
    showHideCSS_ClassVisibility('.tom-label', force, showElseHide);
    // Ben: with 4 tom rows, hidden rows must not take up space
    var tomRows = document.querySelectorAll(
      '#tom2-container, #tom3-container, #tom2-label, #tom3-label'
    );
    for (var t = 0; t < tomRows.length; t++) tomRows[t].style.display = isTomsVisible() ? 'block' : 'none';
    if (OnElseOff) addOrRemoveKeywordFromClassById('showHideTomsButton', 'ClickToHide', true);
    else addOrRemoveKeywordFromClassById('showHideTomsButton', 'ClickToHide', false);

    if (!dontRefreshScreen) updateSheetMusic();

    return false; // don't follow the link
  };

  function isStickingsVisible() {
    var myElements = document.querySelectorAll('.stickings-container');
    for (var i = 0; i < myElements.length; i++) {
      if (myElements[i].style.display == 'block') return true;
    }

    return false;
  }

  root.stickingsShowHide = function (force, showElseHide, dontRefreshScreen) {
    var OnElseOff = showHideCSS_ClassDisplay('.stickings-container', force, showElseHide, 'block');
    showHideCSS_ClassDisplay('.stickings-label', force, showElseHide, 'block');
    if (OnElseOff) {
      addOrRemoveKeywordFromClassById('stickingsButton', 'ClickToHide', true);
    } else {
      addOrRemoveKeywordFromClassById('stickingsButton', 'ClickToHide', false);
    }

    if (!dontRefreshScreen) {
      updateSheetMusic();
    }

    return false; // don't follow the link
  };

  // if stickings are shown, hide them and vice versa
  root.stickingsShowHideToggle = function () {
    var stickingsAreCurrentlyShown = isStickingsVisible();
    root.stickingsShowHide(true, !stickingsAreCurrentlyShown, false);
  };

  // Swap Right and Left stickings if any are shown
  root.stickingsReverseRL = function () {
    for (var i = 0; i < class_number_of_measures * class_notes_per_measure; i++) {
      var cur_state = get_sticking_state(i, 'URL');
      if (cur_state === 'R') {
        set_sticking_state(i, 'left', false);
      } else if (cur_state === 'L') {
        set_sticking_state(i, 'right', false);
      }
    }
    updateSheetMusic();
  };

  root.printMusic = function () {
    var oldMethod = true;

    if (root.browserInfo.browser == 'Chrome' && root.browserInfo.platform == 'windows') {
      oldMethod = false;
    }

    if (oldMethod) {
      // css media queries wiil hide all but the music
      // force a print

      window.print();
    } else {
      // open a new window just for printing   (new method)
      var win = window.open('', class_app_title + ' Print');
      win.document.body.innerHTML = '<title>' + class_app_title + '</title>\n<center>\n';
      win.document.body.innerHTML += document.getElementById('svgTarget').innerHTML;
      win.document.body.innerHTML += '\n</center>';
      win.print();
    }
  };

  root.setupWriterHotKeys = function () {
    document.addEventListener('keydown', function (e) {
      // only accept the event if it not going to an INPUT field   (allow for range types)
      if (
        e.target.type == 'range' ||
        (e.target.tagName.toUpperCase() != 'INPUT' && e.target.tagName.toUpperCase() != 'TEXTAREA')
      ) {
        switch (e.which) {
          case 90: // ctrl-z
            if (e.ctrlKey) {
              // ctrl-z
              root.undoCommand();
              return false;
            }
            break;

          case 89: // ctrl-y
            if (e.ctrlKey) {
              // ctrl-y
              root.redoCommand();
              return false;
            }
            break;

          case 37: // left arrow
            // left arrow
            root.myGrooveUtils.downTempo();
            return false;
          //break;

          case 39: // right arrow
            // right arrow
            root.myGrooveUtils.upTempo();
            return false;
          //break;

          default:
            /* DEBUG
					else if(e.ctrlKey && e.which !=17 && e.target.type != "text") {
					alert("Key is: " + e.which);
					}
					 */
            break;
        }
      }
      return true; // let the default handler deal with the keypress
    });
  };

  root.swapViewEditMode = function (dontUpdateURL) {
    var view_edit_button = document.getElementById('view-edit-switch');

    if (root.myGrooveUtils.viewMode) {
      showHideCSS_ClassDisplay('.edit-block', true, true, 'block'); // show

      if (view_edit_button) view_edit_button.innerHTML = 'Switch to VIEW mode';
      root.myGrooveUtils.viewMode = false;

      if (!dontUpdateURL) root.updateCurrentURL();
    } else {
      showHideCSS_ClassDisplay('.edit-block', true, false, 'block'); // hide

      if (view_edit_button) view_edit_button.innerHTML = 'Switch to EDIT mode';
      root.myGrooveUtils.viewMode = true;
      if (!dontUpdateURL) root.updateCurrentURL();
    }
  };

  // public function.
  // This function initializes the data for the groove Scribe web page
  root.runsOnPageLoad = function () {
    root.setupWriterHotKeys(); // there are other hot keys in GrooveUtils for the midi player

    setupPermutationMenu();
    root.setTimeSigLabel();

    // if Mode != "view" put into edit mode  (we default to view mode to prevent screen flicker)
    if ('view' != root.myGrooveUtils.getQueryVariableFromURL('Mode', 'edit'))
      root.swapViewEditMode(true);

    // set the background and text color of the current subdivision
    selectButton(document.getElementById('subdivision_' + class_notes_per_measure + 'ths'));

    // add html for the midi player
    root.myGrooveUtils.AddMidiPlayerToPage('midiPlayer', class_time_division);

    // load the groove from the URL data if it was passed in.
    set_Default_notes(window.location.search);

    root.myGrooveUtils.midiEventCallbacks.loadMidiDataEvent = function (myroot, playStarting) {
      var midiURL;

      if (playStarting && class_metronome_count_in_active) {
        midiURL = root.myGrooveUtils.MIDI_build_midi_url_count_in_track(
          class_num_beats_per_measure,
          class_note_value_per_measure
        );
        root.myGrooveUtils.midiNoteHasChanged(); // this track is temporary
        class_metronome_count_in_is_playing = true;
      } else {
        if (class_metronome_count_in_is_playing) {
          // we saved the state above so that we could reset the Offset click start, otherwise it starts on the 'e'
          class_metronome_count_in_is_playing = false;
          root.myGrooveUtils.resetMetronomeOptionsOffsetClickStartRotation();
        }
        midiURL = createMidiUrlFromClickableUI('our_MIDI');
        root.myGrooveUtils.midiResetNoteHasChanged();
      }
      root.myGrooveUtils.loadMIDIFromURL(midiURL);
      root.updateGrooveDBSource();
    };

    root.myGrooveUtils.midiEventCallbacks.notePlaying = function (
      myroot,
      note_type,
      percent_complete
    ) {
      if (note_type == 'complete' && class_metronome_auto_speed_up_active) {
        // reload with new tempo
        root.myGrooveUtils.midiNoteHasChanged();
        root.metronomeAutoSpeedUpTempoUpdate();
      }

      hilight_note(note_type, percent_complete);
    };

    root.myGrooveUtils.oneTimeInitializeMidi();

    // enable or disable swing
    root.myGrooveUtils.swingEnabled(
      root.myGrooveUtils.doesDivisionSupportSwing(class_notes_per_measure)
    );

    window.onresize = root.refresh_ABC;

    root.browserInfo = root.myGrooveUtils.getBrowserInfo();
    if (root.browserInfo.browser == 'MSIE' && root.browserInfo.version < 10) {
      window.alert(
        'This browser has been detected as: ' +
          root.browserInfo.browser +
          ' ver: ' +
          root.browserInfo.version +
          '.\n' +
          'This version of IE is unsupported.   Please use Chrome or Firefox instead'
      );
    } else if (
      root.browserInfo.browser == 'Safari' &&
      root.browserInfo.platform == 'windows' &&
      root.browserInfo.version < 535
    ) {
      window.alert(
        'This browser has been detected as: ' +
          root.browserInfo.browser +
          ' ver: ' +
          root.browserInfo.version +
          '.\n' +
          'This version of Safari is unsupported.   Please use Chrome instead'
      );
    }
    if (root.myGrooveUtils.debugMode) {
      var debugOutput = document.getElementById('debugOutput');
      if (debugOutput) {
        debugOutput.innerHTML +=
          '<div>This browser has been detected as: ' +
          root.browserInfo.browser +
          ' ver: ' +
          root.browserInfo.version +
          '.<br>' +
          root.browserInfo.uastring +
          '<br>Running on: ' +
          root.browserInfo.platform +
          '</div>';
      }
    }

    if (root.myGrooveUtils.is_touch_device()) {
      setTimeout(function () {
        window.scrollTo(0, 1);
      }, 1000);
    }

    // get updates when the tempo changes
    root.myGrooveUtils.tempoChangeCallback = root.tempoChangeCallback;
  };

  // called right before the midi reloads for the next replay
  // set the new tempo based on the delta required for the time interval
  var class_our_midi_start_time = null;
  var class_our_midi_start_tempo = 0;
  var class_our_last_midi_tempo_increase_time = null;
  var class_our_last_midi_tempo_increase_remainder = 0;
  root.metronomeAutoSpeedUpTempoUpdate = function () {
    var totalTempoIncreaseAmount = 1;
    if (document.getElementById('metronomeAutoSpeedupTempoIncreaseAmount'))
      totalTempoIncreaseAmount = parseInt(
        document.getElementById('metronomeAutoSpeedupTempoIncreaseAmount').value,
        10
      );
    var tempoIncreaseInterval = 60;
    if (document.getElementById('metronomeAutoSpeedupTempoIncreaseInterval')) {
      tempoIncreaseInterval = parseInt(
        document.getElementById('metronomeAutoSpeedupTempoIncreaseInterval').value,
        10
      );
      tempoIncreaseInterval = tempoIncreaseInterval * 60; // turn mins to secs
    }

    var keepIncreasingForever = false;
    if (document.getElementById('metronomeAutoSpeedUpKeepGoingForever'))
      keepIncreasingForever = document.getElementById(
        'metronomeAutoSpeedUpKeepGoingForever'
      ).checked;

    var curTempo = root.myGrooveUtils.getTempo();

    var midiStartTime = root.myGrooveUtils.getMidiStartTime();
    if (class_our_midi_start_time != midiStartTime) {
      class_our_midi_start_time = midiStartTime;
      class_our_last_midi_tempo_increase_remainder = 0;
      class_our_last_midi_tempo_increase_time = new Date(0);
      class_our_midi_start_tempo = curTempo;
    } else if (!keepIncreasingForever) {
      if (curTempo >= class_our_midi_start_tempo + totalTempoIncreaseAmount) {
        return; // don't increase any more after we have gone up the total amount
      }
    }
    var totalMidiPlayTime = root.myGrooveUtils.getMidiPlayTime();
    var timeDiffMilliseconds =
      totalMidiPlayTime.getTime() - class_our_last_midi_tempo_increase_time.getTime();
    var tempoDiffFloat =
      totalTempoIncreaseAmount * (timeDiffMilliseconds / (tempoIncreaseInterval * 1000));

    // round the number down, but keep track of the remainder so we carry it forward.   Otherwise
    // rounding errors cause us to be way off.
    tempoDiffFloat += class_our_last_midi_tempo_increase_remainder;
    var tempoDiffInt = Math.floor(tempoDiffFloat);
    class_our_last_midi_tempo_increase_remainder = tempoDiffFloat - tempoDiffInt;

    class_our_last_midi_tempo_increase_time = totalMidiPlayTime;

    if (!keepIncreasingForever) {
      if (curTempo + tempoDiffInt > class_our_midi_start_tempo + totalTempoIncreaseAmount) {
        // increase to the total max amount, then we are done
        tempoDiffInt = class_our_midi_start_tempo + totalTempoIncreaseAmount - curTempo;
      }
    }

    if (tempoDiffInt > 0) root.myGrooveUtils.setTempo(root.myGrooveUtils.getTempo() + tempoDiffInt);
  };

  // takes a string of notes encoded in a serialized string and sets the notes on or off
  // uses drum tab format adapted from wikipedia: http://en.wikipedia.org/wiki/Drum_tablature
  //
  //
  //  HiHat support:
  //      x: normal
  //      X: accent
  //      o: open
  //		+: close
  //      c: crash
  //      r: ride
  //      b: ride bell
  //      m: cow bell (more)
  //      s: stacker
  //      -: off
  //
  //   Snare support:
  //      o: normal
  //      O: accent
  //      f: flam
  //      d: drag
  //      g: ghost
  //      x: cross stick
  //      -: off
  //
  //   Kick support:
  //      o: normal
  //      x: hi hat splash with foot
  //      X: kick & hi hat splash with foot simultaneously
  //
  //  Note that "|" and " " will be skipped so that standard drum tabs can be applied
  //  Example:
  //     H=|x---x---x---x---|x---x---x---x---|x---x---x---x---|
  // or  H=x-x-x-x-x-x-x-x-x-x-x-x-
  //     S=|----o-------o---|----o-------o---|----o-------o---|
  // or  S=--o---o---o---o---o---o-
  //     B=|o-------o-------|o-------o-o-----|o-----o-o-------|
  // or  B=o---o---o----oo-o--oo---|
  //
  function setNotesFromURLData(drumType, noteString, numberOfMeasures) {
    var setFunction;

    if (drumType == 'Stickings') {
      setFunction = set_sticking_state;
    } else if (drumType == 'H') {
      setFunction = set_hh_state;
    } else if (drumType == 'T1') {
      setFunction = set_tom1_state;
    } else if (drumType == 'T2') {
      setFunction = set_tom2_state;
    } else if (drumType == 'T3') {
      setFunction = set_tom3_state;
    } else if (drumType == 'T4') {
      setFunction = set_tom4_state;
    } else if (drumType == 'S') {
      setFunction = set_snare_state;
    } else if (drumType == 'K') {
      setFunction = set_kick_state;
    }

    // decode the %7C url encoding types
    noteString = decodeURIComponent(noteString);

    // ignore ":" and "|" by removing them
    var notes = noteString.replace(/:|\|/g, '');

    // multiple measures of "how_many_notes"
    var notesOnScreen = class_notes_per_measure * numberOfMeasures;

    var noteStringScaler = 1;
    var displayScaler = 1;
    if (notes.length > notesOnScreen && notes.length / notesOnScreen >= 2) {
      // if we encounter a 16th note groove for an 8th note board, let's scale it	down
      noteStringScaler = Math.ceil(notes.length / notesOnScreen);
    } else if (notes.length < notesOnScreen && notesOnScreen / notes.length >= 2) {
      // if we encounter a 8th note groove for an 16th note board, let's scale it up
      displayScaler = Math.ceil(notesOnScreen / notes.length);
    }

    //  DisplayIndex is the index into the notes on the HTML page  starts at 1/32\n%%flatbeams
    var displayIndex = 0;
    var topDisplay = class_notes_per_measure * class_number_of_measures;
    for (
      var i = 0;
      i < notes.length && displayIndex < topDisplay;
      i += noteStringScaler, displayIndex += displayScaler
    ) {
      switch (notes[i]) {
        case '$':
          setFunction(displayIndex, 'and', false);
          break;
        case '1':
          setFunction(displayIndex, '1', false);
          break;
        case 'a':
          setFunction(displayIndex, 'a', false);
          break;
        case 'B':
          if (drumType == 'Stickings') setFunction(displayIndex, 'both', false);
          break;
        case 'b':
          if (drumType == 'H') setFunction(displayIndex, 'ride_bell', false);
          else if (drumType == 'S') setFunction(displayIndex, 'buzz', false);
          break;
        case 'c':
          if (drumType == 'Stickings') setFunction(displayIndex, 'count', false);
          else setFunction(displayIndex, 'crash', false);
          break;
        case 'e':
          setFunction(displayIndex, 'e', false);
          break;
        case 'g':
          setFunction(displayIndex, 'ghost', false);
          break;
        case 'f':
          setFunction(displayIndex, 'flam', false);
          break;
        case 'd':
          setFunction(displayIndex, 'drag', false);
          break;
        case 'l':
        case 'L':
          if (drumType == 'Stickings') setFunction(displayIndex, 'left', false);
          break;
        case 'm':
          if (drumType == 'H') setFunction(displayIndex, 'cow_bell', false);
          break;
        case 'n':
          if (drumType == 'H') setFunction(displayIndex, 'metronome_normal', false);
          break;
        case 'N':
          if (drumType == 'H') setFunction(displayIndex, 'metronome_accent', false);
          break;
        case 'O':
          setFunction(displayIndex, 'accent', false);
          break;
        case 'o':
          if (drumType == 'H') setFunction(displayIndex, 'open', false);
          else setFunction(displayIndex, 'normal', false);
          break;
        case 'r':
        case 'R':
          if (drumType == 'H') setFunction(displayIndex, 'ride', false);
          else if (drumType == 'Stickings') setFunction(displayIndex, 'right', false);
          break;
        case 's':
          setFunction(displayIndex, 'stacker', false);
          break;
        case 'x':
          if (drumType == 'S') setFunction(displayIndex, 'xstick', false);
          else if (drumType == 'K') setFunction(displayIndex, 'splash', false);
          else setFunction(displayIndex, 'normal', false);
          break;
        case 'X':
          if (drumType == 'K') setFunction(displayIndex, 'kick_and_splash', false);
          else setFunction(displayIndex, 'accent', false);
          break;
        case '+':
          setFunction(displayIndex, 'close', false);
          break;
        case '-':
          setFunction(displayIndex, 'off', false);
          break;
        default:
          console.log('Bad note in setNotesFromURLData: ' + notes[i]);
          break;
      }
    }
  }

  function setNotesFromABCArray(drumType, abcArray, numberOfMeasures) {
    var setFunction;

    // multiple measures of "how_many_notes"
    var notesOnScreen = class_notes_per_measure * numberOfMeasures;

    var noteStringScaler = 1;
    var displayScaler = 1;
    if (abcArray.length > notesOnScreen && abcArray.length / notesOnScreen >= 2) {
      // if we encounter a 16th note groove for an 8th note board, let's scale it	down
      noteStringScaler = Math.ceil(abcArray.length / notesOnScreen);
    } else if (abcArray.length < notesOnScreen && notesOnScreen / abcArray.length >= 2) {
      // if we encounter a 8th note groove for an 16th note board, let's scale it up
      displayScaler = Math.ceil(notesOnScreen / abcArray.length);
    }

    if (drumType == 'Stickings') {
      setFunction = set_sticking_state;
    } else if (drumType == 'H') {
      setFunction = set_hh_state;
    } else if (drumType == 'T1') {
      setFunction = set_tom1_state;
    } else if (drumType == 'T2') {
      setFunction = set_tom2_state;
    } else if (drumType == 'T3') {
      setFunction = set_tom3_state;
    } else if (drumType == 'T4') {
      setFunction = set_tom4_state;
    } else if (drumType == 'S') {
      setFunction = set_snare_state;
    } else if (drumType == 'K') {
      setFunction = set_kick_state;
    }

    //  DisplayIndex is the index into the notes on the HTML page  starts at 1/32\n%%flatbeams
    var displayIndex = 0;
    var topDisplay = class_notes_per_measure * class_number_of_measures;
    for (
      var i = 0;
      i < abcArray.length && displayIndex < topDisplay;
      i += noteStringScaler, displayIndex += displayScaler
    ) {
      switch (abcArray[i]) {
        case constant_ABC_STICK_R:
          setFunction(displayIndex, 'right', false);
          break;
        case constant_ABC_STICK_L:
          setFunction(displayIndex, 'left', false);
          break;
        case constant_ABC_STICK_BOTH:
          setFunction(displayIndex, 'both', false);
          break;
        case constant_ABC_STICK_COUNT:
          setFunction(displayIndex, 'count', false);
          break;
        case constant_ABC_STICK_OFF:
          setFunction(displayIndex, 'off', false);
          break;
        case constant_ABC_HH_Ride:
          setFunction(displayIndex, 'ride', false);
          break;
        case constant_ABC_HH_Ride_Bell:
          setFunction(displayIndex, 'ride_bell', false);
          break;
        case constant_ABC_HH_Cow_Bell:
          setFunction(displayIndex, 'cow_bell', false);
          break;
        case constant_ABC_HH_Crash:
          setFunction(displayIndex, 'crash', false);
          break;
        case constant_ABC_HH_Stacker:
          setFunction(displayIndex, 'stacker', false);
          break;
        case constant_ABC_HH_Metronome_Normal:
          setFunction(displayIndex, 'metronome_normal', false);
          break;
        case constant_ABC_HH_Metronome_Accent:
          setFunction(displayIndex, 'metronome_accent', false);
          break;
        case constant_ABC_HH_Open:
          setFunction(displayIndex, 'open', false);
          break;
        case constant_ABC_HH_Close:
          setFunction(displayIndex, 'close', false);
          break;
        case constant_ABC_HH_Accent:
          setFunction(displayIndex, 'accent', false);
          break;
        case constant_ABC_HH_Normal:
          setFunction(displayIndex, 'normal', false);
          break;
        case constant_ABC_T1_Normal:
          setFunction(displayIndex, 'normal', false);
          break;
        case constant_ABC_T2_Normal:
          setFunction(displayIndex, 'normal', false);
          break;
        case constant_ABC_T3_Normal:
          setFunction(displayIndex, 'normal', false);
          break;
        case constant_ABC_T4_Normal:
          setFunction(displayIndex, 'normal', false);
          break;
        case constant_ABC_SN_Ghost:
          setFunction(displayIndex, 'ghost', false);
          break;
        case constant_ABC_SN_Accent:
          setFunction(displayIndex, 'accent', false);
          break;
        case constant_ABC_SN_Normal:
          setFunction(displayIndex, 'normal', false);
          break;
        case constant_ABC_SN_Flam:
          setFunction(displayIndex, 'flam', false);
          break;
        case constant_ABC_SN_Drag:
          setFunction(displayIndex, 'drag', false);
          break;
        case constant_ABC_SN_XStick:
          setFunction(displayIndex, 'xstick', false);
          break;
        case constant_ABC_SN_Buzz:
          setFunction(displayIndex, 'buzz', false);
          break;
        case constant_ABC_KI_SandK:
          setFunction(displayIndex, 'kick_and_splash', false);
          break;
        case constant_ABC_KI_Splash:
          setFunction(displayIndex, 'splash', false);
          break;
        case constant_ABC_KI_Normal:
          setFunction(displayIndex, 'normal', false);
          break;
        case false:
          setFunction(displayIndex, 'off', false);
          break;
        default:
          console.log('Bad note in setNotesFromABCArray: ' + abcArray[i]);
          break;
      }
    }
  }

  // get a really long URL that encodes all of the notes and the rest of the state of the page.
  // this will allow us to bookmark or reference a groove and handle undo/redo.
  //
  function get_FullURLForPage(url_destination) {
    var myGrooveData = root.grooveDataFromClickableUI();
    return root.myGrooveUtils.getUrlStringFromGrooveData(myGrooveData, url_destination);
  }

  root.show_MetronomeAutoSpeedupConfiguration = function () {
    var popup = document.getElementById('metronomeAutoSpeedupConfiguration');

    if (popup) {
      popup.style.display = 'block';
    }

    document.getElementById('metronomeAutoSpeedupTempoIncreaseAmountOutput').innerHTML =
      document.getElementById('metronomeAutoSpeedupTempoIncreaseAmount').value;
    document.getElementById('metronomeAutoSpeedupTempoIncreaseIntervalOutput').innerHTML =
      document.getElementById('metronomeAutoSpeedupTempoIncreaseInterval').value;
  };

  root.close_MetronomeAutoSpeedupConfiguration = function (type) {
    var popup = document.getElementById('metronomeAutoSpeedupConfiguration');

    if (popup) popup.style.display = 'none';
  };

  root.timeSigPopupOpen = function (type) {
    var popup = document.getElementById('timeSigPopup');

    if (popup) popup.style.display = 'block';
  };

  // turns on or off triplet 1/4 and 1/8 note selection based on the current time sig setting
  root.setTimeDivisionSelectionOnOrOff = function () {
    // check for incompatible odd time signature division  9/16 and 1/8 notes for instance
    if (((8 * class_num_beats_per_measure) / class_note_value_per_measure) % 1 != 0) {
      addOrRemoveKeywordFromClassById('subdivision_8ths', 'disabled', true);
    } else {
      addOrRemoveKeywordFromClassById('subdivision_8ths', 'disabled', false);
    }

    if (class_note_value_per_measure != 4) {
      // triplets are too complicated right now outside of x/4 time.
      // disable them

      addOrRemoveKeywordFromClassById('subdivision_12ths', 'disabled', true);
      addOrRemoveKeywordFromClassById('subdivision_24ths', 'disabled', true);
      addOrRemoveKeywordFromClassById('subdivision_48ths', 'disabled', true);
    } else {
      addOrRemoveKeywordFromClassById('subdivision_12ths', 'disabled', false);
      addOrRemoveKeywordFromClassById('subdivision_24ths', 'disabled', false);
      addOrRemoveKeywordFromClassById('subdivision_48ths', 'disabled', false);
    }
  };

  root.setTimeSigLabel = function () {
    // turn on/off special features that are only available in 4/4 time

    // set the label
    document.getElementById('timeSigLabel').innerHTML =
      '<sup>' +
      class_num_beats_per_measure +
      '</sup>/<sub>' +
      class_note_value_per_measure +
      '</sub>';
  };

  root.timeSigPopupClose = function (type, callback) {
    var popup = document.getElementById('timeSigPopup');

    if (popup) popup.style.display = 'none';

    // ignore type "cancel"
    if (type == 'ok') {
      // Ben: the popup sets the time signature of every bar; keeps the notes that still fit
      var newTimeSigTop = parseInt(document.getElementById('timeSigPopupTimeSigTop').value, 10);
      var newTimeSigBottom = parseInt(
        document.getElementById('timeSigPopupTimeSigBottom').value,
        10
      );
      var bars = readBars();
      bars.forEach(function (bar) {
        bar.meter = [newTimeSigTop, newTimeSigBottom];
        var cells = Math.floor((bar.div * newTimeSigTop) / newTimeSigBottom);
        BAR_INSTRUMENTS.forEach(function (inst) {
          var arr = bar.notes[inst].slice(0, cells);
          while (arr.length < cells) arr.push('-');
          bar.notes[inst] = arr;
        });
        bar.levels = [];
      });
      var newDiv = parseInt(class_time_division, 10);
      if (newDiv % 12 === 0 && newTimeSigBottom != 4) newDiv = 16;
      if (!Number.isInteger((newDiv * newTimeSigTop) / newTimeSigBottom)) newDiv = 16;
      if (!Number.isInteger((newDiv * newTimeSigTop) / newTimeSigBottom)) newDiv = 32;
      commitBars(bars, newDiv);
    }
    if (callback) {
      callback();
    }
  };

  root.updateRangeLabel = function (event, idToUpdate) {
    var element = document.getElementById(idToUpdate);

    if (element) {
      element.innerHTML = event.currentTarget.value;
    }
  };

  root.fillInFullURLInFullURLPopup = function () {
    document.getElementById('embedCodeCheckbox').checked = false; // uncheck embedCodeCheckbox
    document.getElementById('shortenerCheckbox').checked = false; // uncheck shortenerCheckbox

    var popup = document.getElementById('fullURLPopup');
    if (popup) {
      var fullURL = get_FullURLForPage();
      var textField = document.getElementById('fullURLPopupTextField');
      textField.value = fullURL;

      popup.style.display = 'block';

      // select the URL for copy/paste
      textField.focus();
      textField.select();
    }
  };

  root.show_FullURLPopup = function () {
    document.getElementById('fullURLPopup');


    // open the popup with full url and try to load short in the background
    root.fillInFullURLInFullURLPopup();
    // default is to use shortened url
    fillInShortenedURLInFullURLPopup(get_FullURLForPage(), 'fullURLPopupTextField');
  };

  root.copyShareURLToClipboard = function () {
    var copyText = document.getElementById('fullURLPopupTextField');

    copyText.select();
    // hack fix for mobile
    copyText.setSelectionRange(0, 99999);

    document.execCommand('copy');
  };

  root.close_FullURLPopup = function () {
    var popup = document.getElementById('fullURLPopup');

    if (popup) popup.style.display = 'none';
  };

  function fillInShortenedURLInFullURLPopup(fullURL, cssIdOfTextFieldToFill) {
    // Ben: the old short-link service (Firebase Dynamic Links) no longer exists; keep the full link
    document.getElementById('shortenerCheckbox').checked = false;
    return;
    // eslint-disable-next-line no-unreachable
    document.getElementById('embedCodeCheckbox').checked = false; // uncheck embedCodeCheckbox, because it is not compatible

    var params = {
      dynamicLinkInfo: {
        domainUriPrefix: 'https://gscribe.com/share',
        link: fullURL,
      },
    };

    var xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      'https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=AIzaSyBx4So11fGFPgTI62nP-JmxrxHmuRpJ120'
    );
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      if (xhr.status === 200) {
        // success
        var response = JSON.parse(xhr.responseText);
        var textField = document.getElementById(cssIdOfTextFieldToFill);
        textField.value = response.shortLink;
        // select the URL for copy/paste
        textField.focus();
        textField.select();
        document.getElementById('shortenerCheckbox').checked = true; // this is now true if isn't already
      } else {
        document.getElementById('shortenerCheckbox').checked = false; // request failed
      }
    };
    xhr.send(JSON.stringify(params));
  }

  // embed looks something like this:
  // <iframe width="100%" height="240" src="https://hosting.com/path/GrooveDisplay.html?Div=16&Title=Example..." frameborder="0" ></iframe>
  function fillInEmbedURLInFullURLPopup(fullURL, cssIdOfTextFieldToFill) {
    document.getElementById('shortenerCheckbox').checked = false; // uncheck shortenerCheckbox, because it is not compatible
    document.getElementById('embedCodeCheckbox').checked = true; // this will be true if isn't already

    var embedText =
      '<iframe width="100%" height="240" src="' + fullURL + '" frameborder="0" ></iframe>	';

    var textField = document.getElementById(cssIdOfTextFieldToFill);
    textField.value = embedText;

    // select the URL for copy/paste
    textField.focus();
    textField.select();
  }

  root.shortenerCheckboxChanged = function () {
    if (document.getElementById('shortenerCheckbox').checked) {
      fillInShortenedURLInFullURLPopup(get_FullURLForPage(), 'fullURLPopupTextField');
    } else {
      root.fillInFullURLInFullURLPopup();
    }
  };

  root.embedCodeCheckboxChanged = function () {
    if (document.getElementById('embedCodeCheckbox').checked) {
      fillInEmbedURLInFullURLPopup(get_FullURLForPage('display'), 'fullURLPopupTextField');
    } else {
      fillInShortenedURLInFullURLPopup(get_FullURLForPage(), 'fullURLPopupTextField');
    }
  };

  function set_Default_notes(encodedURLData) {
    var myGrooveData = root.myGrooveUtils.getGrooveDataFromUrlString(encodedURLData);

    class_num_beats_per_measure = myGrooveData.numBeats; // TimeSigTop
    class_note_value_per_measure = myGrooveData.noteValue; // TimeSigBottom
    class_measure_meters = (myGrooveData.measureMeters || []).map((mt) => [mt[0], mt[1]]);
    class_bar_stash = {};
    class_loop_bars = {};
    class_play_from = null;

    if (
      myGrooveData.notesPerMeasure != class_notes_per_measure ||
      class_number_of_measures != myGrooveData.numberOfMeasures
    ) {
      class_number_of_measures = myGrooveData.numberOfMeasures;
      changeDivisionWithNotes(myGrooveData.timeDivision);
    }

    root.expandAuthoringViewWhenNecessary(class_notes_per_measure, class_number_of_measures);

    setNotesFromABCArray('Stickings', myGrooveData.sticking_array, class_number_of_measures);
    setNotesFromABCArray('H', myGrooveData.hh_array, class_number_of_measures);
    setNotesFromABCArray('T1', myGrooveData.toms_array[0], class_number_of_measures);
    setNotesFromABCArray('T2', myGrooveData.toms_array[1], class_number_of_measures);
    setNotesFromABCArray('T3', myGrooveData.toms_array[2], class_number_of_measures);
    setNotesFromABCArray('T4', myGrooveData.toms_array[3], class_number_of_measures);
    setNotesFromABCArray('S', myGrooveData.snare_array, class_number_of_measures);
    setNotesFromABCArray('K', myGrooveData.kick_array, class_number_of_measures);

    if (myGrooveData.showToms) root.showHideToms(true, true, true);

    if (myGrooveData.showStickings) root.stickingsShowHide(true, true, true);

    document.getElementById('tuneTitle').value = myGrooveData.title;

    document.getElementById('tuneAuthor').value = myGrooveData.author;

    document.getElementById('tuneComments').value = myGrooveData.comments;

    root.myGrooveUtils.setTempo(myGrooveData.tempo);

    root.myGrooveUtils.setSwing(myGrooveData.swingPercent);

    root.setMetronomeFrequency(myGrooveData.metronomeFrequency);

    class_beat_res = {}; // recompute from the loaded notes
    applyGridVisibility();

    updateSheetMusic();
  }

  root.loadNewGroove = function (encodedURLData) {
    set_Default_notes(encodedURLData);
  };

  function getABCDataWithLineEndings() {
    var myABC = document.getElementById('ABCsource').value;

    // add proper line endings for windows
    myABC = myABC.replace(/\r?\n/g, '\r\n');

    return myABC;
  }

  root.saveABCtoFile = function () {
    var myABC = getABCDataWithLineEndings();

    var myURL = 'data:text/plain;charset=utf-8;base64,' + btoa(myABC);

    console.log('Use "Save As" to save the new page to a local file');
    window.open(myURL);
  };

  // change the base division to something else.
  // eg  16th to 8ths or   32nds to 8th note triplets
  // need to re-layout the html notes, change any globals and then reinitialize
  //
  // OMG this needs to be refactored really bad.   There is a GrooveData struct from groove utils that
  //      would make this whole thing much easier.  :(
  function changeDivisionWithNotes(newDivision, Stickings, HH, Tom1, Tom4, Snare, Kick, Tom2, Tom3) {
    var oldDivision = class_time_division;
    var wasStickingsVisable = isStickingsVisible();
    var wasTomsVisable = isTomsVisible();

    class_time_division = newDivision;
    class_notes_per_measure = root.myGrooveUtils.calc_notes_per_measure(
      class_time_division,
      class_num_beats_per_measure,
      class_note_value_per_measure
    );

    var newHTML = '';
    for (var cur_measure = 1; cur_measure <= class_number_of_measures; cur_measure++) {
      newHTML += root.HTMLforStaffContainer(
        cur_measure,
        (cur_measure - 1) * class_notes_per_measure
      );
    }

    // rewrite the HTML for the HTML note grid
    document.getElementById('measureContainer').innerHTML = newHTML;

    // change the Permutation options too
    newHTML = root.HTMLforPermutationOptions();
    document.getElementById('PermutationOptions').innerHTML = newHTML;

    if (wasStickingsVisable) root.stickingsShowHide(true, true, true);

    if (wasTomsVisable) root.showHideToms(true, true, true);

    // now set the right notes on and off
    if (Stickings && HH && Tom1 && Tom4 && Snare && Kick) {
      setNotesFromURLData('Stickings', Stickings, class_number_of_measures);
      setNotesFromURLData('H', HH, class_number_of_measures);
      setNotesFromURLData('T1', Tom1, class_number_of_measures);
      setNotesFromURLData('T4', Tom4, class_number_of_measures);
      if (Tom2) setNotesFromURLData('T2', Tom2, class_number_of_measures);
      if (Tom3) setNotesFromURLData('T3', Tom3, class_number_of_measures);
      setNotesFromURLData('S', Snare, class_number_of_measures);
      setNotesFromURLData('K', Kick, class_number_of_measures);
    }

    // un-highlight the old div
    unselectButton(document.getElementById('subdivision_' + oldDivision + 'ths'));

    // highlight the new div
    selectButton(document.getElementById('subdivision_' + class_time_division + 'ths'));

    // This may disable or enable the menu
    setupPermutationMenu();

    // may turn on or off triplets and 1/4 or 1/8th notes based on time signature
    root.setTimeDivisionSelectionOnOrOff();

    // change the time label
    root.setTimeSigLabel();

    // enable or disable swing
    root.myGrooveUtils.swingEnabled(root.myGrooveUtils.doesDivisionSupportSwing(newDivision));

    applyGridVisibility();
  }

  root.expandAuthoringViewWhenNecessary = function (numNotesPerMeasure, numberOfMeasures) {
    // set the size of the musicalInput authoring element based on the number of notes
    if (
      numNotesPerMeasure > 16 ||
      (numNotesPerMeasure > 4 && class_number_of_measures > 1) ||
      class_number_of_measures > 2
    ) {
      addOrRemoveKeywordFromClassById('musicalInput', 'expanded', true);
    } else {
      addOrRemoveKeywordFromClassById('musicalInput', 'expanded', false);
    }
  };

  // change the base division to something else.
  // eg  16th to 8ths or   32nds to 8th note triplets
  // need to re-layout the html notes, change any globals and then reinitialize
  var have_shown_mixed_division_message = false;
  function originalChangeDivision(newDivision) {
    var uiStickings = '|';
    var uiHH = '|';
    var uiTom1 = '|';
    var uiTom2 = '|';
    var uiTom3 = '|';
    var uiTom4 = '|';
    var uiSnare = '|';
    var uiKick = '|';

    if (newDivision == 48 && !have_shown_mixed_division_message) {
      have_shown_mixed_division_message = true;
      alert(
        'The MIXED subdivision allows you to create a combination of triplets and non-triplet notes in one measure.  Set every 3rd note for 16ths and every 6th note for 8th notes'
      );
    }

    var isNewDivisionTriplets = root.myGrooveUtils.isTripletDivision(newDivision);
    var new_notes_per_measure = root.myGrooveUtils.calc_notes_per_measure(
      isNewDivisionTriplets ? 48 : 32,
      class_num_beats_per_measure,
      class_note_value_per_measure
    );

    // check for incompatible odd time signature division   9/8 and 1/4notes for instance or 9/16 and 1/8notes
    if (((newDivision * class_num_beats_per_measure) / class_note_value_per_measure) % 1 != 0) {
      alert(
        '1/' +
          newDivision +
          ' notes are disabled in ' +
          class_num_beats_per_measure +
          '/' +
          class_note_value_per_measure +
          ' time.  This combination would result in a half note.'
      );
      return;
    }
    if (isNewDivisionTriplets && class_note_value_per_measure != 4) {
      alert(
        'Triplets are disabled in ' +
          class_num_beats_per_measure +
          '/' +
          class_note_value_per_measure +
          ' time.  Use x/4 time for triplets.'
      );
      return;
    }

    if (usingTriplets() === isNewDivisionTriplets) {
      // get the encoded notes out of the UI.
      // run through both measures.
      var topIndex = class_notes_per_measure * class_number_of_measures;
      for (var i = 0; i < topIndex; i++) {
        uiStickings += get_sticking_state(i, 'URL');
        uiHH += get_hh_state(i, 'URL');
        uiTom1 += get_tom_state(i, 1, 'URL');
        uiTom2 += get_tom_state(i, 2, 'URL');
        uiTom3 += get_tom_state(i, 3, 'URL');
        uiTom4 += get_tom_state(i, 4, 'URL');
        uiSnare += get_snare_state(i, 'URL');
        uiKick += get_kick_state(i, 'URL');
      }

      // override the hi-hat if we are going to a higher division.
      // otherwise the notes get lost in translation (not enough)
      //if (newDivision > class_notes_per_measure)
      //	uiHH = root.myGrooveUtils.GetDefaultHHGroove(new_notes_per_measure, class_num_beats_per_measure, class_note_value_per_measure, class_number_of_measures);
    } else {
      // changing from or changing to a triplet division
      // triplets don't scale well, so use defaults when we change
      uiStickings = root.myGrooveUtils.GetDefaultStickingsGroove(
        new_notes_per_measure,
        class_num_beats_per_measure,
        class_note_value_per_measure,
        class_number_of_measures
      );
      uiHH = root.myGrooveUtils.GetDefaultHHGroove(
        new_notes_per_measure,
        class_num_beats_per_measure,
        class_note_value_per_measure,
        class_number_of_measures
      );
      uiTom1 = root.myGrooveUtils.GetDefaultTom1Groove(
        new_notes_per_measure,
        class_num_beats_per_measure,
        class_note_value_per_measure,
        class_number_of_measures
      );
      uiTom2 = uiTom3 = root.myGrooveUtils.GetDefaultTom1Groove(
        new_notes_per_measure,
        class_num_beats_per_measure,
        class_note_value_per_measure,
        class_number_of_measures
      );
      uiTom4 = root.myGrooveUtils.GetDefaultTom4Groove(
        new_notes_per_measure,
        class_num_beats_per_measure,
        class_note_value_per_measure,
        class_number_of_measures
      );
      uiSnare = root.myGrooveUtils.GetDefaultSnareGroove(
        new_notes_per_measure,
        class_num_beats_per_measure,
        class_note_value_per_measure,
        class_number_of_measures
      );
      uiKick = root.myGrooveUtils.GetDefaultKickGroove(
        new_notes_per_measure,
        class_num_beats_per_measure,
        class_note_value_per_measure,
        class_number_of_measures
      );

      // reset the metronome click, since it has different options
      root.resetMetronomeOptionsMenuOffsetClick();
    }

    root.expandAuthoringViewWhenNecessary(newDivision, class_number_of_measures);

    changeDivisionWithNotes(
      newDivision,
      uiStickings,
      uiHH,
      uiTom1,
      uiTom4,
      uiSnare,
      uiKick,
      uiTom2,
      uiTom3
    );

    updateSheetMusic();
  }


  // ---------------------------------------------------------------------------
  // Ben: bar engine — per-bar time signatures, per-beat grid (incl. triplets),
  // bar tools (add/copy/move/clear/delete), play-from-bar and looping bars.
  // Every structural change goes: readBars() -> change the list -> writeBars().
  // ---------------------------------------------------------------------------
  var BAR_INSTRUMENTS = ['Stickings', 'H', 'S', 'K', 'T1', 'T2', 'T3', 'T4'];

  function noteChar(inst, idx) {
    switch (inst) {
      case 'Stickings':
        return get_sticking_state(idx, 'URL');
      case 'H':
        return get_hh_state(idx, 'URL');
      case 'S':
        return get_snare_state(idx, 'URL');
      case 'K':
        return get_kick_state(idx, 'URL');
      default:
        return get_tom_state(idx, parseInt(inst.charAt(1), 10), 'URL');
    }
  }

  function baseMeter() {
    return [parseInt(class_num_beats_per_measure, 10), parseInt(class_note_value_per_measure, 10)];
  }

  function meterFor(m) {
    var base = baseMeter();
    var mt = class_measure_meters[m];
    if (mt && barFraction(mt, base[0], base[1]) <= 1.0000001) return [mt[0], mt[1]];
    return base;
  }

  function barFrac(m) {
    var base = baseMeter();
    return barFraction(meterFor(m), base[0], base[1]);
  }

  function usedCells(m) {
    return Math.round(class_notes_per_measure * barFrac(m));
  }

  function metersArrayOrNull() {
    var base = baseMeter();
    var arr = [];
    var mixed = false;
    for (var m = 0; m < class_number_of_measures; m++) {
      arr.push(meterFor(m));
      if (arr[m][0] != base[0] || arr[m][1] != base[1]) mixed = true;
    }
    return mixed ? arr : null;
  }

  // ----- per-beat grid levels -----
  var LEVEL_CELLS = { 4: 1, 8: 2, 16: 4, 32: 8, '8t': 3, '16t': 6 }; // cells per quarter note
  var LEVEL_LABELS = {
    4: '1/4',
    8: '1/8',
    16: '1/16',
    32: '1/32',
    '8t': 'triplets',
    '16t': 'sextuplets',
  };
  var LEVEL_ORDER = ['4', '8', '16', '8t', '16t', '32'];
  var DIV_FOR_CELLS_PER_QUARTER = { 1: 4, 2: 8, 4: 16, 8: 32, 3: 12, 6: 24, 12: 48 };

  function cellsPerQuarter() {
    return parseInt(class_time_division, 10) / 4;
  }

  function perBeatSupported() {
    return baseMeter()[1] == 4 && Number.isInteger(cellsPerQuarter());
  }

  function levelFits(level) {
    return Number.isInteger(cellsPerQuarter() / LEVEL_CELLS[level]);
  }

  function defaultLevel() {
    var div = parseInt(class_time_division, 10);
    if (div == 12) return '8t';
    if (div == 24) return '16t';
    if (div == 48) return '16';
    return String(Math.min(div, 16));
  }

  function beatNoteOffsets(m, b) {
    var cpq = cellsPerQuarter();
    var offs = [];
    for (var j = 0; j < cpq; j++) {
      var cell = b * cpq + j;
      if (cell >= usedCells(m)) break;
      var idx = m * class_notes_per_measure + cell;
      for (var k = 0; k < BAR_INSTRUMENTS.length; k++) {
        if (noteChar(BAR_INSTRUMENTS[k], idx) !== '-') {
          offs.push(j);
          break;
        }
      }
    }
    return offs;
  }

  function levelShowsOffsets(level, offs) {
    var step = cellsPerQuarter() / LEVEL_CELLS[level];
    return offs.every((o) => o % step === 0);
  }

  function beatLevel(m, b) {
    var key = m + '-' + b;
    var stored = class_beat_res[key];
    if (stored && levelFits(stored)) return stored;
    var offs = beatNoteOffsets(m, b);
    var candidates = [defaultLevel()].concat(LEVEL_ORDER);
    var level = String(parseInt(class_time_division, 10));
    for (var c = 0; c < candidates.length; c++) {
      if (levelFits(candidates[c]) && levelShowsOffsets(candidates[c], offs)) {
        level = candidates[c];
        break;
      }
    }
    class_beat_res[key] = level;
    return level;
  }

  function beatsInBar(m) {
    return Math.ceil(usedCells(m) / cellsPerQuarter() - 1e-9);
  }

  // ----- reading / writing the whole grid -----
  function readBars() {
    var bars = [];
    for (var m = 0; m < class_number_of_measures; m++) {
      var bar = {
        meter: meterFor(m),
        div: parseInt(class_time_division, 10),
        notes: {},
        levels: [],
        loop: !!class_loop_bars[m],
      };
      var cells = usedCells(m);
      BAR_INSTRUMENTS.forEach(function (inst) {
        var arr = [];
        for (var j = 0; j < cells; j++) arr.push(noteChar(inst, m * class_notes_per_measure + j));
        bar.notes[inst] = arr;
      });
      if (perBeatSupported()) for (var b = 0; b < beatsInBar(m); b++) bar.levels.push(beatLevel(m, b));
      bars.push(bar);
    }
    return bars;
  }

  function emptyBarLike(bar) {
    var nb = { meter: bar.meter.slice(), div: bar.div, notes: {}, levels: bar.levels.slice(), loop: false };
    BAR_INSTRUMENTS.forEach(function (inst) {
      nb.notes[inst] = bar.notes[inst].map(() => '-');
    });
    return nb;
  }

  function copyBar(bar) {
    var nb = emptyBarLike(bar);
    BAR_INSTRUMENTS.forEach(function (inst) {
      nb.notes[inst] = bar.notes[inst].slice();
    });
    return nb;
  }

  // returns '' on success, otherwise a message why it can't be done
  function writeBars(bars, newDiv) {
    newDiv = parseInt(newDiv, 10);
    var meters = bars.map((b) => b.meter);
    var base = chooseBaseMeter(meters);
    var isTriplet = newDiv % 12 === 0;
    if (isTriplet && meters.some((mt) => mt[1] != 4))
      return 'This groove has triplets/sextuplets, and those only work when every bar is in x/4. Set the triplet beats back to 1/16 first.';
    var npm = (newDiv / base[1]) * base[0];
    if (!Number.isInteger(npm)) return 'This grid does not fit the time signature.';
    var strings = {};
    BAR_INSTRUMENTS.forEach((inst) => (strings[inst] = ''));
    for (var m = 0; m < bars.length; m++) {
      var bar = bars[m];
      var cells = (newDiv * bar.meter[0]) / bar.meter[1];
      if (!Number.isInteger(cells))
        return 'Bar ' + (m + 1) + ' (' + bar.meter.join('/') + ') does not fit this grid.';
      for (var k = 0; k < BAR_INSTRUMENTS.length; k++) {
        var inst = BAR_INSTRUMENTS[k];
        var out = new Array(npm).fill('-');
        var src = bar.notes[inst] || [];
        for (var j = 0; j < src.length; j++) {
          if (src[j] === '-' || src[j] === undefined) continue;
          var nj = (j * newDiv) / bar.div;
          if (!Number.isInteger(nj) || nj >= cells)
            return 'Bar ' + (m + 1) + ' has notes that do not fit on that grid.';
          out[nj] = src[j];
        }
        strings[inst] += out.join('');
      }
    }
    // commit
    class_num_beats_per_measure = base[0];
    class_note_value_per_measure = base[1];
    class_number_of_measures = bars.length;
    class_measure_meters = meters.map((mt) => [mt[0], mt[1]]);
    class_beat_res = {};
    class_loop_bars = {};
    bars.forEach(function (bar, m) {
      bar.levels.forEach((lv, b) => (class_beat_res[m + '-' + b] = lv));
      if (bar.loop) class_loop_bars[m] = true;
    });
    if (class_play_from !== null && class_play_from >= bars.length) class_play_from = null;
    root.expandAuthoringViewWhenNecessary(npm, class_number_of_measures);
    changeDivisionWithNotes(
      newDiv,
      strings.Stickings,
      strings.H,
      strings.T1,
      strings.T4,
      strings.S,
      strings.K,
      strings.T2,
      strings.T3
    );
    root.setTimeSigLabel && root.setTimeSigLabel();
    return '';
  }

  function commitBars(bars, newDiv) {
    var err = writeBars(bars, newDiv === undefined ? class_time_division : newDiv);
    if (err) {
      alert(err);
      applyGridVisibility();
      return false;
    }
    root.myGrooveUtils.midiNoteHasChanged();
    updateSheetMusic();
    return true;
  }

  // ----- showing / hiding grid cells -----
  var CELL_ID_PREFIXES = [
    'bg-highlight',
    'sticking',
    'hi-hat',
    'tom1-',
    'tom2-',
    'tom3-',
    'tom4-',
    'snare',
    'kick',
  ];

  function applyGridVisibility() {
    var npm = class_notes_per_measure;
    var cpq = cellsPerQuarter();
    var perBeat = perBeatSupported();
    for (var m = 0; m < class_number_of_measures; m++) {
      var cells = usedCells(m);
      for (var j = 0; j < npm; j++) {
        var idx = m * npm + j;
        var show = j < cells;
        if (show && perBeat) {
          var level = beatLevel(m, Math.floor(j / cpq));
          show = (j % cpq) % (cpq / LEVEL_CELLS[level]) === 0;
        }
        for (var p = 0; p < CELL_ID_PREFIXES.length; p++) {
          var el = document.getElementById(CELL_ID_PREFIXES[p] + idx);
          if (el) el.style.display = show ? '' : 'none';
        }
      }
      var container = document.getElementById('staff-container' + (m + 1));
      if (!container) continue;
      var spacers = container.querySelectorAll('.space_between_note_groups');
      for (var s = 0; s < spacers.length; s++) {
        var prev = spacers[s].previousElementSibling;
        var num = prev && prev.id ? prev.id.match(/(\d+)$/) : null;
        if (num) spacers[s].style.display = parseInt(num[1], 10) - m * npm + 1 >= cells ? 'none' : '';
      }
      container.classList.toggle('ben-play-from', class_play_from === m);
      container.classList.toggle('ben-looped', !!class_loop_bars[m]);
      renderBarControls(container, m, perBeat);
    }
    renderSheetOverlay();
    fitBarsToScreen();
    updateTripletMetronomeButtons();
  }

  // Ben: triplet / sextuplet metronome only makes sense (and only works) on a triplet-based grid
  function updateTripletMetronomeButtons() {
    var trip = root.myGrooveUtils.isTripletDivision(class_time_division);
    ['metronomeTrip', 'metronomeSext'].forEach(function (bid) {
      var b = document.getElementById(bid);
      if (b) b.style.display = trip ? '' : 'none';
    });
    var f = root.class_metronome_frequency;
    if (!trip && (f == 12 || f == 24)) root.setMetronomeFrequency(4);
  }

  // Ben: on phones, shrink the note grid of each bar so a whole bar fits the screen width
  function fitBarsToScreen() {
    var phone = window.innerWidth <= 720;
    // keep the "+" button after the last bar (it is rendered inside the last bar)
    var plus = document.getElementById('addMeasureButton');
    var mc = document.getElementById('measureContainer');
    if (plus && mc && plus.parentNode !== mc) mc.appendChild(plus);
    if (plus) {
      // sits right next to the last bar (same grid cell, pushed past the card)
      var lastCard = document.getElementById('staff-container' + class_number_of_measures);
      plus.style.gridRow = String(Math.max(1, class_number_of_measures));
      plus.style.gridColumn = phone ? '' : '1';
      plus.style.marginLeft = !phone && lastCard ? lastCard.offsetWidth + 16 + 'px' : '';
    }
    for (var m = 0; m < class_number_of_measures; m++) {
      var card = document.getElementById('staff-container' + (m + 1));
      var grid = card && card.querySelector('.notes-row-container');
      if (!grid) continue;
      card.style.gridRow = phone ? '' : String(m + 1); // explicit rows so the "+" can share the last one
      grid.style.zoom = '';
      card.style.setProperty('--ben-z', 1);
      if (!phone) {
        card.style.removeProperty('--ben-z');
        // card as wide as its note grid (min. room for the toolbar), so all bars look tidy;
        // in a narrow column (side-by-side layout) the grid shrinks to fit
        card.style.width = '';
        var room = (mc ? mc.clientWidth : window.innerWidth) - 110;
        var want = grid.scrollWidth + 28;
        var zz = want > room ? Math.max(0.6, room / want) : 1;
        if (zz < 1) grid.style.zoom = zz;
        card.style.width = Math.min(Math.max(want * zz, 520), Math.max(room, 520)) + 'px';
        continue;
      }
      card.style.width = '';
      // measure the grid with a 40px label column, then shrink it to fit
      var labels = grid.querySelector('.line-labels');
      var rowEl = grid.querySelector('.background-highlight-container') || grid.querySelector('.hi-hat-container');
      var natural = (rowEl ? rowEl.scrollWidth : grid.scrollWidth) + 6;
      var avail = card.clientWidth - 14 - 38;
      var z = Math.max(0.55, Math.min(1, avail / natural));
      grid.style.zoom = z;
      card.style.setProperty('--ben-z', z);
      card.classList.toggle("ben-fits", avail / natural >= 0.55);
    }
    // now that the cards have their final width, put the "+" right after the last one
    var plusBtn = document.getElementById('addMeasureButton');
    var lastBar = document.getElementById('staff-container' + class_number_of_measures);
    if (plusBtn && lastBar && !phone) plusBtn.style.marginLeft = lastBar.offsetWidth + 16 + 'px';
  }
  window.addEventListener('resize', function () {
    clearTimeout(fitBarsToScreen._t);
    fitBarsToScreen._t = setTimeout(fitBarsToScreen, 150);
  });

  function selectHTML(onchange, options, current) {
    var html = '<select onchange="' + onchange + '">';
    options.forEach(function (o) {
      html +=
        '<option value="' + o[0] + '"' + (String(o[0]) == String(current) ? ' selected' : '') + '>' + o[1] + '</option>';
    });
    return html + '</select>';
  }

  function renderBarControls(container, m, perBeat) {
    var bar = container.querySelector('.ben-bar-controls');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'ben-bar-controls';
      container.insertBefore(bar, container.firstChild);
    }
    var meter = meterFor(m);
    var tops = [];
    for (var t = 1; t <= 16; t++) tops.push([t, t]);
    var html = '<span class="ben-bar-label">Bar ' + (m + 1) + '</span>';
    html +=
      '<span class="ben-meter" title="Time signature of this bar">' +
      selectHTML('myGrooveWriter.setBarMeter(' + m + ', this.value, null)', tops, meter[0]) +
      '/' +
      selectHTML(
        'myGrooveWriter.setBarMeter(' + m + ', null, this.value)',
        [
          [2, 2],
          [4, 4],
          [8, 8],
          [16, 16],
        ],
        meter[1]
      ) +
      '</span>';
    if (perBeat) {
      var levelOptions = LEVEL_ORDER.map((l) => [l, LEVEL_LABELS[l]]);
      html +=
        '<label class="ben-beat ben-all-beats" title="Set every beat of this bar">all ' +
        selectHTML('myGrooveWriter.setAllBeats(' + m + ', this.value)', [['', '…']].concat(levelOptions), '') +
        '</label>';
      for (var b = 0; b < beatsInBar(m); b++) {
        html +=
          '<label class="ben-beat" title="Grid for beat ' + (b + 1) + '">' + (b + 1) + ' ' +
          selectHTML('myGrooveWriter.setBeatResolution(' + m + ',' + b + ', this.value)', levelOptions, beatLevel(m, b)) +
          '</label>';
      }
    }
    html += '<span class="ben-tools">';
    html +=
      '<button title="Play from this bar" class="' + (class_play_from === m ? 'on' : '') + '" onclick="myGrooveWriter.playFromBar(' + m + ')"><i class="fa fa-play"></i></button>';
    html +=
      '<button title="Loop this bar (select several bars to loop them together)" class="' + (class_loop_bars[m] ? 'on' : '') + '" onclick="myGrooveWriter.toggleLoopBar(' + m + ')"><i class="fa fa-repeat"></i></button>';
    html += '<button title="Move bar left" onclick="myGrooveWriter.moveBar(' + m + ',-1)"' + (m === 0 ? ' disabled' : '') + '><i class="fa fa-arrow-left"></i></button>';
    html +=
      '<button title="Move bar right" onclick="myGrooveWriter.moveBar(' + m + ',1)"' + (m === class_number_of_measures - 1 ? ' disabled' : '') + '><i class="fa fa-arrow-right"></i></button>';
    html += '<button title="Insert an empty bar after this one" onclick="myGrooveWriter.insertEmptyBar(' + m + ')"><i class="fa fa-plus-square-o"></i></button>';
    html += '<button title="Duplicate this bar (the copy goes right after it)" onclick="myGrooveWriter.duplicateBar(' + m + ')"><i class="fa fa-clone"></i></button>';
    html += '<button title="Clear this bar" onclick="myGrooveWriter.clearBar(' + m + ')"><i class="fa fa-eraser"></i></button>';
    if (class_number_of_measures > 1)
      html += '<button title="Delete this bar" onclick="myGrooveWriter.deleteBar(' + m + ')"><i class="fa fa-trash"></i></button>';
    html += '</span>';
    bar.innerHTML = html;
  }

  // ----- public actions -----
  // left-hand subdivision buttons: keep every note when it fits the new grid
  root.changeDivision = function (newDivision) {
    var bars = readBars();
    bars.forEach((bar) => (bar.levels = []));
    var err = writeBars(bars, newDivision);
    if (!err) {
      root.myGrooveUtils.midiNoteHasChanged();
      updateSheetMusic();
      return;
    }
    if (
      !confirm(
        'Not every note fits on the new grid (' + err + ')\nSwitch anyway? Notes that do not fit will be lost.'
      )
    )
      return;
    originalChangeDivision(newDivision);
  };

  root.setBarMeter = function (m, top, bottom) {
    var bars = readBars();
    var meter = bars[m].meter.slice();
    if (top) meter[0] = parseInt(top, 10);
    if (bottom) meter[1] = parseInt(bottom, 10);
    var oldCells = bars[m].notes.H.length;
    bars[m].meter = meter;
    var newCells = (bars[m].div * meter[0]) / meter[1];
    // remember notes that a shorter bar cuts off, so making it longer again brings them back
    var stash = class_bar_stash[m];
    if (stash && stash.div != bars[m].div) stash = null;
    var full = {};
    BAR_INSTRUMENTS.forEach(function (inst) {
      var cur = bars[m].notes[inst].slice();
      var old = stash ? stash.notes[inst] : [];
      for (var j = cur.length; j < old.length; j++) cur.push(old[j]);
      full[inst] = cur;
    });
    class_bar_stash[m] = { div: bars[m].div, notes: full };
    BAR_INSTRUMENTS.forEach(function (inst) {
      var arr = full[inst].slice(0, Math.floor(newCells));
      while (arr.length < newCells) arr.push('-');
      bars[m].notes[inst] = arr;
    });
    bars[m].levels = [];
    var div = parseInt(class_time_division, 10);
    if (!Number.isInteger(newCells) && newCells !== oldCells) {
      // e.g. 7/8 on a 1/4-note grid: go to a finer grid
      div = Math.max(div, 16);
    }
    commitBars(bars, div);
  };

  root.setBeatResolution = function (m, b, level) {
    var cur = beatLevel(m, b);
    if (level == cur) return;
    var offs = beatNoteOffsets(m, b);
    // every note already in this beat must land on the new grid
    var cpq = cellsPerQuarter();
    if (!offs.every((o) => Number.isInteger((o * LEVEL_CELLS[level]) / cpq))) {
      alert(
        'Beat ' + (b + 1) + ' has notes that do not fit on ' + LEVEL_LABELS[level] + '. Remove them first.'
      );
      applyGridVisibility();
      return;
    }
    if (levelFits(level)) {
      class_beat_res[m + '-' + b] = level;
      applyGridVisibility();
      return;
    }
    // a different base grid is needed for the whole groove
    var bars = readBars();
    bars[m].levels[b] = level;
    var stuck = relaxGridConflicts(bars, level);
    var lcm = 1;
    var gcd = (x, y) => (y ? gcd(y, x % y) : x);
    bars.forEach(function (bar) {
      bar.levels.forEach(function (lv) {
        var c = LEVEL_CELLS[lv];
        lcm = (lcm * c) / gcd(lcm, c);
      });
    });
    var newDiv = DIV_FOR_CELLS_PER_QUARTER[lcm];
    if (!newDiv) {
      alert(gridConflictMessage(stuck));
      applyGridVisibility();
      return;
    }
    commitBars(bars, newDiv);
  };

  // Ben: 1/32 and triplets can't share one groove. Before giving up, move beats of the
  // "other" kind to a plain grid when their notes allow it (empty beats always can).
  function relaxGridConflicts(bars, keep) {
    var cpq = cellsPerQuarter();
    var isTrip = (lv) => lv == '8t' || lv == '16t';
    var hasTrip = false;
    var has32 = false;
    bars.forEach((bar) => bar.levels.forEach((lv) => ((hasTrip = hasTrip || isTrip(lv)), (has32 = has32 || lv == '32'))));
    if (!hasTrip || !has32) return '';
    var keepTrip = isTrip(keep);
    var stuck = '';
    bars.forEach(function (bar, m) {
      bar.levels.forEach(function (lv, b) {
        var conflicting = keepTrip ? lv == '32' : isTrip(lv);
        if (!conflicting) return;
        var offs = [];
        for (var j = 0; j < cpq; j++) {
          var cell = b * cpq + j;
          if (cell >= bar.notes.H.length) break;
          if (BAR_INSTRUMENTS.some((inst) => inst != 'Stickings' && bar.notes[inst][cell] !== '-')) offs.push(j);
        }
        var to = ['16', '8', '4'].find(function (l) {
          var step = cpq / LEVEL_CELLS[l];
          return Number.isInteger(step) && offs.every((o) => o % step === 0);
        });
        if (to) bar.levels[b] = to;
        else if (!stuck) stuck = 'bar ' + (m + 1) + ', beat ' + (b + 1);
      });
    });
    return stuck;
  }

  function gridConflictMessage(stuck) {
    return (
      '1/32 notes and triplets/sextuplets cannot be combined in one groove' +
      (stuck ? ' (' + stuck + ' still has notes that need its current grid).' : '.')
    );
  }

  // Ben: one grid for every beat of a bar (scope = bar index) or of the whole groove (scope = 'all')
  var DIV_FOR_LEVEL = { 4: 4, 8: 8, 16: 16, 32: 32, '8t': 12, '16t': 24 };
  root.setAllBeats = function (scope, level) {
    if (!level || !LEVEL_CELLS[level]) return;
    if (!perBeatSupported()) {
      // x/8-based grooves have no per-beat grid: switch the whole groove like the old left bar did
      originalChangeDivision(DIV_FOR_LEVEL[level]);
      return;
    }
    var bars = readBars();
    var cpq = cellsPerQuarter();
    var step = cpq / LEVEL_CELLS[level]; // may be fractional when the grid must get finer
    var dropped = 0;
    bars.forEach(function (bar, m) {
      if (scope !== 'all' && scope !== m) return;
      for (var b = 0; b < bar.levels.length; b++) {
        for (var j = 0; j < cpq; j++) {
          var cell = b * cpq + j;
          if (cell >= bar.notes.H.length) break;
          if (Number.isInteger(j / step)) continue;
          BAR_INSTRUMENTS.forEach(function (inst) {
            if (bar.notes[inst][cell] !== '-' && bar.notes[inst][cell] !== undefined) {
              if (inst !== 'Stickings') dropped++;
              bar.notes[inst][cell] = '-';
            }
          });
        }
        bar.levels[b] = level;
      }
    });
    if (
      dropped &&
      !confirm(dropped + ' note(s) do not fit on ' + LEVEL_LABELS[level] + ' and will be removed. Continue?')
    ) {
      applyGridVisibility();
      return;
    }
    var stuck = relaxGridConflicts(bars, level);
    var gcd = (x, y) => (y ? gcd(y, x % y) : x);
    var lcm = 1;
    bars.forEach(function (bar) {
      bar.levels.forEach(function (lv) {
        var c = LEVEL_CELLS[lv];
        lcm = (lcm * c) / gcd(lcm, c);
      });
    });
    var newDiv = DIV_FOR_CELLS_PER_QUARTER[lcm];
    if (!newDiv) {
      alert(gridConflictMessage(stuck));
      applyGridVisibility();
      return;
    }
    class_bar_stash = {};
    commitBars(bars, newDiv);
  };

  root.addBar = function (mode) {
    class_bar_stash = {};
    closeAddBarMenu();
    var bars = readBars();
    var last = bars[bars.length - 1];
    bars.push(mode == 'copy' ? copyBar(last) : emptyBarLike(last));
    if (commitBars(bars)) {
      var el = document.getElementById('staff-container' + bars.length);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  root.duplicateBar = function (m) {
    class_bar_stash = {};
    var bars = readBars();
    bars.splice(m + 1, 0, copyBar(bars[m]));
    commitBars(bars);
  };

  root.insertEmptyBar = function (m) {
    class_bar_stash = {};
    var bars = readBars();
    bars.splice(m + 1, 0, emptyBarLike(bars[m]));
    if (commitBars(bars)) {
      var el = document.getElementById('staff-container' + (m + 2));
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  root.clearBar = function (m) {
    class_bar_stash = {};
    var bars = readBars();
    bars[m] = emptyBarLike(bars[m]);
    bars[m].loop = !!class_loop_bars[m];
    commitBars(bars);
  };

  root.deleteBar = function (m) {
    class_bar_stash = {};
    var bars = readBars();
    if (bars.length < 2) return root.clearBar(m);
    bars.splice(m, 1);
    if (class_play_from !== null) class_play_from = class_play_from > m ? class_play_from - 1 : class_play_from === m ? null : class_play_from;
    commitBars(bars);
  };

  root.moveBar = function (m, dir) {
    class_bar_stash = {};
    var bars = readBars();
    var to = m + dir;
    if (to < 0 || to >= bars.length) return;
    var tmp = bars[m];
    bars[m] = bars[to];
    bars[to] = tmp;
    if (class_play_from === m) class_play_from = to;
    else if (class_play_from === to) class_play_from = m;
    commitBars(bars);
  };

  function restartPlaybackIfPlaying(forceStart) {
    var gu = root.myGrooveUtils;
    var wasPlaying = gu.isPlaying && gu.isPlaying();
    gu.midiNoteHasChanged();
    if (wasPlaying || forceStart) {
      gu.stopMIDI_playback();
      gu.startMIDI_playback();
    }
  }

  root.playFromBar = function (m) {
    if (class_play_from === m) {
      class_play_from = null; // click again to play from the start
      applyGridVisibility();
      restartPlaybackIfPlaying(false);
      return;
    }
    class_play_from = m;
    applyGridVisibility();
    restartPlaybackIfPlaying(true);
  };

  root.toggleLoopBar = function (m) {
    if (class_loop_bars[m]) delete class_loop_bars[m];
    else class_loop_bars[m] = true;
    applyGridVisibility();
    restartPlaybackIfPlaying(false);
  };

  // bars that the play button plays: looped bars, else from the chosen bar, else all
  function barsToPlay(useSelection) {
    if (root._benExportAll) useSelection = false; // audio export: always the whole groove
    var all = [];
    for (var m = 0; m < class_number_of_measures; m++) all.push(m);
    if (!useSelection) return all;
    var loops = all.filter((m) => class_loop_bars[m]);
    if (loops.length) return loops;
    if (class_play_from !== null && class_play_from < class_number_of_measures)
      return all.filter((m) => m >= class_play_from);
    return all;
  }

  // where in the grid / sheet the playback is, given the share of the MIDI that has played
  function timelinePosition(percent) {
    var total = 0;
    class_play_timeline.forEach((t) => (total += t.slots));
    if (!total) return null;
    var pos = percent * total;
    for (var i = 0; i < class_play_timeline.length; i++) {
      var t = class_play_timeline[i];
      if (pos < t.slots || i == class_play_timeline.length - 1) return { bar: t.bar, slot: Math.min(pos, t.slots - 1e-6) };
      pos -= t.slots;
    }
    return null;
  }

  function fullSlotsPerMeasure() {
    var base = baseMeter();
    return root.myGrooveUtils.calc_notes_per_measure(usingTriplets() ? 48 : 32, base[0], base[1]);
  }

  // ---------------------------------------------------------------------
  // Ben: play cursor + loop range directly on the sheet music.
  // Click a bar = play from there. Drag across bars = loop them.
  // Drag the loop's edge handles to change the range; x removes the loop.
  // ---------------------------------------------------------------------
  function loopRange() {
    var bars = Object.keys(class_loop_bars)
      .map(Number)
      .filter((m) => m < class_number_of_measures)
      .sort((a, b) => a - b);
    return bars.length ? [bars[0], bars[bars.length - 1]] : null;
  }

  function setLoopRange(a, b) {
    class_loop_bars = {};
    if (a !== null) for (var m = Math.min(a, b); m <= Math.max(a, b); m++) class_loop_bars[m] = true;
  }

  // per bar: {left, right, top, bottom} in px relative to #svgTarget
  function sheetBarRects(svgTarget) {
    var T = svgTarget.getBoundingClientRect();
    var marks = Array.prototype.slice.call(svgTarget.querySelectorAll('.benbar'));
    var n = class_number_of_measures;
    if (marks.length < n) return [];
    marks = marks.slice(marks.length - n); // skip legend bars, if shown
    var rects = [];
    var prevRow = null;
    var prevX = 0;
    marks.forEach(function (mk) {
      var svg = mk.ownerSVGElement;
      var S = svg.getBoundingClientRect();
      var r = mk.getBoundingClientRect();
      var x = r.left + r.width / 2 - T.left;
      var left = svg === prevRow ? prevX : S.left - T.left + 8;
      var st = svgTarget.scrollTop;
      rects.push({ left: left, right: x, top: S.top - T.top + st, bottom: S.bottom - T.top + st });
      prevRow = svg;
      prevX = x;
    });
    return rects;
  }

  function barAtPoint(rects, x, y) {
    var best = -1;
    var bestDist = Infinity;
    rects.forEach(function (r, m) {
      var dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      var dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      var d = dy * 4 + dx;
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    });
    return best;
  }

  var class_sheet_drag = null;

  function renderSheetOverlay() {
    var svgTarget = document.getElementById('svgTarget');
    if (!svgTarget || class_permutation_type != 'none') return;
    var layer = svgTarget.querySelector('.ben-sheet-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'ben-sheet-layer';
      layer.title = 'Click a bar to play from there. Drag across bars to loop them.';
      svgTarget.appendChild(layer);
      layer.addEventListener('pointerdown', sheetPointerDown);
      layer.addEventListener('pointermove', sheetPointerMove);
      layer.addEventListener('pointerup', sheetPointerUp);
      layer.addEventListener('pointerleave', function () {
        var hv = layer.querySelector('.ben-sheet-hover');
        if (hv) hv.style.opacity = '0';
      });
      layer.addEventListener('pointercancel', function () {
        class_sheet_drag = null;
        renderSheetOverlay();
      });
    }
    var rects = sheetBarRects(svgTarget);
    layer._rects = rects;
    layer.style.height = svgTarget.scrollHeight + 'px';
    updateSheetPin();
    var html = '';
    var range = class_sheet_drag && class_sheet_drag.range ? class_sheet_drag.range : loopRange();
    if (range) {
      for (var m = range[0]; m <= range[1]; m++) {
        var r = rects[m];
        if (!r) continue;
        html +=
          '<div class="ben-sheet-loop" style="left:' + r.left + 'px;top:' + r.top + 'px;width:' +
          (r.right - r.left) + 'px;height:' + (r.bottom - r.top) + 'px"></div>';
      }
      var a = rects[range[0]];
      var b = rects[range[1]];
      if (a && b) {
        html += '<div class="ben-sheet-handle" data-handle="start" title="Drag to change where the loop starts" style="left:' +
          (a.left - 6) + 'px;top:' + a.top + 'px;height:' + (a.bottom - a.top) + 'px"></div>';
        html += '<div class="ben-sheet-handle" data-handle="end" title="Drag to change where the loop ends" style="left:' +
          (b.right - 6) + 'px;top:' + b.top + 'px;height:' + (b.bottom - b.top) + 'px"></div>';
        if (!class_sheet_drag)
          html += '<button class="ben-sheet-loop-off" title="Stop looping" style="left:' + (b.right - 9) + 'px;top:' +
            (b.top - 9) + 'px">&times;</button>';
      }
    }
    var c = class_play_from !== null ? rects[class_play_from] : null;
    if (c)
      html += '<div class="ben-sheet-cursor" title="Playback starts here (click it again to start from the beginning)" style="left:' +
        c.left + 'px;top:' + c.top + 'px;height:' + (c.bottom - c.top) + 'px"></div>';
    layer.innerHTML = html;
    var off = layer.querySelector('.ben-sheet-loop-off');
    if (off)
      off.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
        e.preventDefault();
        setLoopRange(null);
        applyGridVisibility();
        restartPlaybackIfPlaying(false);
      });
  }

  function layerPoint(e) {
    var layer = e.currentTarget;
    var L = layer.getBoundingClientRect();
    return { layer: layer, bar: barAtPoint(layer._rects || [], e.clientX - L.left, e.clientY - L.top) };
  }

  function sheetPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    var p = layerPoint(e);
    if (p.bar < 0) return;
    var handle = e.target && e.target.getAttribute && e.target.getAttribute('data-handle');
    var range = loopRange();
    if (handle && range) {
      class_sheet_drag = { mode: handle, anchor: handle == 'start' ? range[1] : range[0], range: range.slice(), moved: true };
    } else {
      class_sheet_drag = { mode: 'new', anchor: p.bar, start: p.bar, range: null, moved: false };
    }
    try {
      p.layer.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    e.preventDefault();
  }

  function sheetPointerMove(e) {
    if (!class_sheet_drag) {
      var hp = layerPoint(e);
      var hr = hp.layer._rects && hp.layer._rects[hp.bar];
      var hv = hp.layer.querySelector('.ben-sheet-hover');
      if (!hv) {
        hv = document.createElement('div');
        hv.className = 'ben-sheet-hover';
        hp.layer.insertBefore(hv, hp.layer.firstChild);
      }
      if (hr) {
        hv.style.cssText = 'left:' + hr.left + 'px;top:' + hr.top + 'px;width:' + (hr.right - hr.left) + 'px;height:' + (hr.bottom - hr.top) + 'px;opacity:1';
      }
      return;
    }
    var p = layerPoint(e);
    if (p.bar < 0) return;
    var d = class_sheet_drag;
    if (d.mode == 'new' && !d.moved && p.bar == d.start) return;
    d.moved = true;
    var a = d.anchor;
    var nr = [Math.min(a, p.bar), Math.max(a, p.bar)];
    if (!d.range || nr[0] != d.range[0] || nr[1] != d.range[1]) {
      d.range = nr;
      renderSheetOverlay();
    }
  }

  function sheetPointerUp(e) {
    var d = class_sheet_drag;
    class_sheet_drag = null;
    if (!d) return;
    if (d.moved && d.range) {
      setLoopRange(d.range[0], d.range[1]);
      applyGridVisibility();
      restartPlaybackIfPlaying(false);
    } else if (!d.moved) {
      // click: move the play cursor to this bar (click it again to go back to the start)
      class_play_from = class_play_from === d.start ? null : d.start;
      var card = document.getElementById('staff-container' + (d.start + 1));
      if (card) {
        card.scrollIntoView({ block: 'start', behavior: 'smooth' });
        card.classList.remove('ben-flash');
        void card.offsetWidth; // restart the animation
        card.classList.add('ben-flash');
      }
      applyGridVisibility();
      restartPlaybackIfPlaying(false);
    } else {
      renderSheetOverlay();
    }
  }

  window.addEventListener('resize', function () {
    setTimeout(renderSheetOverlay, 300);
  });

  // ---------------------------------------------------------------------
  // Ben: optional "Ride" row. It is a view on the hi-hat lane: a slot is either
  // hi-hat-ish or ride/ride bell, stored as r/b in H= like normal Groove Scribe,
  // so links stay compatible with every Groove Scribe player.
  // ---------------------------------------------------------------------
  var class_ride_visible = null; // null = auto (show when the groove has ride notes)
  var RIDE_GREY = 'rgb(204, 204, 204)';

  // cymbal rows above the hi-hat: crash and ride. Each is a view on the hi-hat lane.
  var CYM_ROWS = [
    { key: 'crash', prefix: 'benC_', label: 'Crash', states: ['c'], on: 'crash', glyph: 'hh_crash',
      menu: [['crash', 'Crash'], ['stacker', 'Stacker / china'], ['off', 'Off']], extra: { s: 'stacker' } },
    { key: 'ride', prefix: 'benR_', label: 'Ride', states: ['r', 'b'], on: 'ride', glyph: 'hh_ride',
      menu: [['ride', 'Ride'], ['ride_bell', 'Ride bell'], ['off', 'Off']], extra: { b: 'ride_bell' } },
  ];
  // stacker (x) is shown in the crash row as well
  CYM_ROWS[0].states.push('s');
  function cymRowFor(st) {
    for (var i = 0; i < CYM_ROWS.length; i++) if (CYM_ROWS[i].states.indexOf(st) >= 0) return CYM_ROWS[i];
    return null;
  }

  function grooveHasRide() {
    var n = class_number_of_measures * class_notes_per_measure;
    for (var i = 0; i < n; i++) {
      var el = document.getElementById('hi-hat' + i);
      if (!el) continue;
      if (cymRowFor(get_hh_state(i, 'URL'))) return true;
    }
    return false;
  }

  function isRideVisible() {
    return class_ride_visible === null ? grooveHasRide() : class_ride_visible;
  }

  function setRideSlot(id, mode) {
    set_hh_state(id, mode, mode != 'off');
    updateSheetMusic();
  }

  function rideMenu(event, id, cym) {
    var old = document.getElementById('benRideMenu');
    if (old) old.remove();
    var menu = document.createElement('div');
    menu.id = 'benRideMenu';
    menu.className = 'ben-add-bar-menu';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    cym.menu.forEach(function (o) {
      var b = document.createElement('button');
      b.textContent = o[1];
      b.onclick = function () {
        menu.remove();
        setRideSlot(id, o[0]);
      };
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    setTimeout(function () {
      document.addEventListener('pointerdown', function close(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('pointerdown', close, true);
        }
      }, true);
    }, 0);
  }

  function buildCymRow(container, hhRow, cym) {
    var row = hhRow.cloneNode(true);
    row.className = 'hi-hat-container ben-ride-container ben-cym-' + cym.key;
    row.querySelectorAll('[id]').forEach(function (el) {
      el.id = cym.prefix + el.id;
      el.removeAttribute('onclick');
      el.removeAttribute('oncontextmenu');
      el.removeAttribute('onmouseenter');
    });
    row.addEventListener('click', function (e) {
      var cell = e.target.closest('.hi-hat');
      if (!cell) return;
      var id = parseInt(cell.id.replace(cym.prefix + 'hi-hat', ''), 10);
      setRideSlot(id, cymRowFor(get_hh_state(id, 'URL')) === cym ? 'off' : cym.on);
    });
    row.addEventListener('contextmenu', function (e) {
      var cell = e.target.closest('.hi-hat');
      if (!cell) return;
      e.preventDefault();
      rideMenu(e, parseInt(cell.id.replace(cym.prefix + 'hi-hat', ''), 10), cym);
    });
    return row;
  }

  function renderRideRows() {
    var show = isRideVisible();
    var btn = document.getElementById('showHideRideButton');
    if (btn) btn.classList.toggle('ClickToHide', show);
    // keep the TOMS button state in sync with what is really shown
    var tbtn = document.getElementById('showHideTomsButton');
    if (tbtn) tbtn.classList.toggle('ClickToHide', isTomsVisible());
    var npm = class_notes_per_measure;
    for (var m = 0; m < class_number_of_measures; m++) {
      var container = document.getElementById('staff-container' + (m + 1));
      if (!container) continue;
      var hhRow = container.querySelector('.hi-hat-container:not(.ben-ride-container)');
      container.classList.toggle('ben-ride-on', show);
      if (!show) {
        container.querySelectorAll('.ben-ride-container, .ben-ride-label').forEach((el) => el.remove());
        container.querySelectorAll('.hi-hat.ben-on-ride').forEach((c) => c.classList.remove('ben-on-ride'));
        continue;
      }
      if (!hhRow) continue;
      var hhLabel = container.querySelector('.hh-label:not(.ben-ride-label)');
      CYM_ROWS.forEach(function (cym) {
        var row = container.querySelector('.ben-cym-' + cym.key);
        if (!row) hhRow.parentNode.insertBefore(buildCymRow(container, hhRow, cym), hhRow);
        if (!container.querySelector('.ben-label-' + cym.key) && hhLabel) {
          var label = document.createElement('div');
          label.className = 'hh-label ben-ride-label ben-label-' + cym.key;
          label.textContent = cym.label;
          label.title = 'Click a cell: ' + cym.label.toLowerCase() + ' on/off. Right-click a cell: more options';
          hhLabel.parentNode.insertBefore(label, hhLabel);
        }
      });
      // sync cells, visibility and spacers with the hi-hat row
      for (var j = 0; j < npm; j++) {
        var id = m * npm + j;
        var hhCell = document.getElementById('hi-hat' + id);
        if (!hhCell) continue;
        var st = get_hh_state(id, 'URL');
        var owner = cymRowFor(st);
        hhCell.classList.toggle('ben-on-ride', !!owner);
        CYM_ROWS.forEach(function (cym) {
          var cell = document.getElementById(cym.prefix + 'hi-hat' + id);
          if (!cell) return;
          cell.style.display = hhCell.style.display;
          cell.querySelectorAll('.note_part').forEach((p) => (p.style.color = 'transparent'));
          var glyph = cym.glyph;
          if (owner === cym && cym.extra[st]) glyph = 'hh_' + cym.extra[st];
          var g = document.getElementById(cym.prefix + glyph + id);
          if (g) g.style.color = owner === cym ? constant_note_on_color_hex : RIDE_GREY;
        });
      }
      var hs = hhRow.children;
      container.querySelectorAll('.ben-ride-container').forEach(function (row) {
        var rs = row.children;
        for (var k = 0; k < hs.length && k < rs.length; k++)
          if (hs[k].classList.contains('space_between_note_groups')) rs[k].style.display = hs[k].style.display;
      });
    }
  }

  root.showHideRide = function () {
    class_ride_visible = !isRideVisible();
    renderRideRows();
    return false;
  };

  // clicking a hi-hat cell that holds a ride note puts a hi-hat there (the ride lives in its own row)
  document.addEventListener(
    'click',
    function (e) {
      var cell = e.target.closest && e.target.closest('.hi-hat.ben-on-ride');
      if (!cell || !cell.id || /^ben[RC]_/.test(cell.id)) return;
      e.stopPropagation();
      e.preventDefault();
      setRideSlot(parseInt(cell.id.replace('hi-hat', ''), 10), 'normal');
    },
    true
  );

  // ---------------------------------------------------------------------
  // Ben: pinned sheet (stays visible while you scroll the grid) and
  // playback that follows the playing bar in the grid and in the sheet.
  // ---------------------------------------------------------------------
  var class_sheet_pinned = true;
  try {
    var savedPin = localStorage.getItem('benSheetPinned');
    // default: pinned on computers, not on phones (screen space)
    class_sheet_pinned = savedPin === null ? !window.matchMedia('(max-width: 720px), (max-height: 520px)').matches : savedPin !== '0';
  } catch (e) {
    /* storage may be unavailable */
  }

  // ---- sheet layout: on top (default), side by side, or in its own window ----
  var class_sheet_layout = 'top';
  try {
    class_sheet_layout = localStorage.getItem('benLayout') || 'top';
    if (class_sheet_layout == 'window') class_sheet_layout = 'top'; // pop-ups can't reopen by themselves
    var savedH = localStorage.getItem('benSheetMaxH');
    if (savedH) document.documentElement.style.setProperty('--ben-sheet-maxh', savedH);
  } catch (e) {
    /* ignore */
  }
  document.documentElement.classList.toggle('ben-split', class_sheet_layout == 'split');
  var benPop = null;
  function benPopupOpen() {
    return benPop && !benPop.closed;
  }
  function setSheetLayout(mode) {
    if (mode == 'window') {
      benPop = window.open('', 'drumsheet_sheet', 'width=1000,height=640');
      if (!benPop) {
        alert('Your browser blocked the extra window. Allow pop-ups for this site and try again.');
        mode = 'top';
      } else {
        benPop.document.open();
        benPop.document.write(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Drumsheet: sheet music</title>' +
            '<style>body{margin:0;padding:16px 20px;background:#fff;font-family:system-ui,sans-serif}' +
            'svg{display:block;width:100%;height:auto;margin:0 0 6px}' +
            '.abcr{fill:transparent}.abcr.highlighted{fill:rgba(50,126,173,.25)}</style></head>' +
            '<body><div id="s"></div></body></html>'
        );
        benPop.document.close();
        benPop.addEventListener('resize', function () {
          clearTimeout(benPop._t);
          benPop._t = setTimeout(root.refresh_ABC, 200);
        });
        benPop.addEventListener('beforeunload', function () {
          setTimeout(function () {
            if (!benPopupOpen()) setSheetLayout('top');
          }, 300);
        });
      }
    } else if (benPopupOpen()) {
      benPop.close();
      benPop = null;
    }
    class_sheet_layout = mode;
    document.documentElement.classList.toggle('ben-split', mode == 'split');
    document.documentElement.classList.toggle('ben-popped', mode == 'window');
    try {
      localStorage.setItem('benLayout', mode);
    } catch (e) {
      /* ignore */
    }
    root.refresh_ABC();
    setTimeout(applyGridVisibility, 50);
  }
  root.setSheetLayout = setSheetLayout;
  // copy the sheet into the pop-out window after every redraw (and the playback highlight)
  function mirrorSheetToPopup() {
    if (!benPopupOpen()) return;
    var box = benPop.document.getElementById('s');
    if (!box) return;
    box.innerHTML = Array.prototype.map
      .call(document.querySelectorAll('#svgTarget svg'), function (el) {
        return el.outerHTML;
      })
      .join('');
  }
  setInterval(function () {
    if (benPopupOpen() && root.myGrooveUtils.isPlaying && root.myGrooveUtils.isPlaying()) {
      var on = document.querySelector('#svgTarget .abcr.highlighted');
      var box = benPop.document.getElementById('s');
      if (!box) return;
      box.querySelectorAll('.abcr.highlighted').forEach((el) => el.classList.remove('highlighted'));
      if (on) {
        var twin = box.querySelector('#' + CSS.escape(on.id));
        if (twin) twin.classList.add('highlighted');
      }
    }
  }, 60);

  function getBarsPerLineSetting() {
    var v = 0;
    try {
      v = parseInt(localStorage.getItem('benBarsPerLine') || '0', 10) || 0;
    } catch (e) {
      /* ignore */
    }
    return v;
  }

  function updateSheetPin() {
    var div = document.getElementById('sheetMusicDiv');
    if (!div) return;
    div.classList.toggle('ben-pinned', class_sheet_pinned);
    var btn = document.getElementById('benSheetPin');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'benSheetPin';
      btn.onclick = function () {
        class_sheet_pinned = !class_sheet_pinned;
        try {
          localStorage.setItem('benSheetPinned', class_sheet_pinned ? '1' : '0');
        } catch (e) {
          /* ignore */
        }
        updateSheetPin();
      };
      div.appendChild(btn);
    }
    btn.className = class_sheet_pinned ? 'on' : '';
    var lay = document.getElementById('benSheetLayout');
    if (!lay) {
      lay = document.createElement('select');
      lay.id = 'benSheetLayout';
      lay.title = 'Where the sheet music goes';
      lay.innerHTML =
        '<option value="top">Sheet on top</option><option value="split">Sheet left, editor right</option>' +
        '<option value="window">Sheet in its own window</option>';
      lay.onchange = function () {
        setSheetLayout(lay.value);
      };
      div.appendChild(lay);
    }
    lay.value = class_sheet_layout;
    var handle = document.getElementById('benSheetResize');
    if (!handle) {
      handle = document.createElement('div');
      handle.id = 'benSheetResize';
      handle.title = 'Drag to make the sheet taller or shorter';
      div.appendChild(handle);
      handle.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var svgT = document.getElementById('svgTarget');
        var startY = e.clientY;
        var startH = svgT.getBoundingClientRect().height;
        handle.setPointerCapture(e.pointerId);
        var move = function (ev) {
          var h = Math.max(80, Math.min(window.innerHeight * 0.85, startH + ev.clientY - startY));
          document.documentElement.style.setProperty('--ben-sheet-maxh', Math.round(h) + 'px');
        };
        var up = function () {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', up);
          try {
            localStorage.setItem('benSheetMaxH', getComputedStyle(document.documentElement).getPropertyValue('--ben-sheet-maxh').trim());
          } catch (err) {
            /* ignore */
          }
          updateSheetPin();
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
      });
    }
    var bpl = document.getElementById('benBarsPerLine');
    if (!bpl) {
      bpl = document.createElement('select');
      bpl.id = 'benBarsPerLine';
      bpl.title = 'Bars per line in the sheet music';
      bpl.innerHTML =
        '<option value="0">Bars/line: auto</option><option value="1">1 bar/line</option>' +
        '<option value="2">2 bars/line</option><option value="3">3 bars/line</option><option value="4">4 bars/line</option>';
      bpl.value = String(getBarsPerLineSetting());
      bpl.onchange = function () {
        try {
          localStorage.setItem('benBarsPerLine', bpl.value);
        } catch (e) {
          /* ignore */
        }
        root.refresh_ABC();
      };
      div.appendChild(bpl);
    }
    btn.title = class_sheet_pinned ? 'Sheet stays on screen while you scroll (click to unpin)' : 'Pin the sheet to the top while you scroll';
    btn.innerHTML = '<i class="fa fa-thumb-tack"></i>';
    var h = class_sheet_pinned ? div.offsetHeight : 0;
    document.documentElement.style.setProperty('--ben-sheet-h', h + 'px');
    document.documentElement.style.setProperty('--ben-header-h', headerBottom() + 'px');
  }

  // the top bar + player are fixed; the page itself scrolls underneath them
  function isSmallScreen() {
    return window.matchMedia('(max-width: 720px), (max-height: 520px)').matches;
  }
  function headerBottom() {
    var p = document.getElementById('midiPlayer');
    if (!p) return 0;
    if (isSmallScreen()) return p.offsetHeight; // only the sticky player stays on top
    return Math.max(0, Math.round(p.getBoundingClientRect().bottom));
  }

  var class_followed_bar = -1;
  function followPlayingBar(bar) {
    if (bar === class_followed_bar) return;
    class_followed_bar = bar;
    var card = document.getElementById('staff-container' + (bar + 1));
    if (card) {
      var C = card.getBoundingClientRect();
      var top = headerBottom() + (class_sheet_pinned ? document.getElementById('sheetMusicDiv').offsetHeight : 0);
      if (C.top < top || C.bottom > window.innerHeight) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    var svgTarget = document.getElementById('svgTarget');
    var layer = svgTarget && svgTarget.querySelector('.ben-sheet-layer');
    var r = layer && layer._rects && layer._rects[bar];
    if (r && svgTarget.scrollHeight > svgTarget.clientHeight + 2) {
      if (r.top < svgTarget.scrollTop || r.bottom > svgTarget.scrollTop + svgTarget.clientHeight)
        svgTarget.scrollTo({ top: Math.max(0, r.top - 8), behavior: 'smooth' });
    }
  }
  window.addEventListener('resize', function () {
    setTimeout(updateSheetPin, 300);
  });

  // ---------------------------------------------------------------------
  // Ben: touch long-press = right-click (iPhone has no right-click / contextmenu)
  // ---------------------------------------------------------------------
  (function () {
    var timer = null;
    var startXY = null;
    var suppressClickUntil = 0;
    var suppressNativeMenuUntil = 0;
    var CELL = '.hi-hat, .snare, .kick, .tom, .sticking, .hh-label, .snare-label, .kick-label, .tom-label, .stickings-label';
    document.addEventListener(
      'pointerdown',
      function (e) {
        if (e.pointerType !== 'touch') return;
        var cell = e.target.closest && e.target.closest(CELL);
        if (!cell) return;
        startXY = [e.clientX, e.clientY];
        clearTimeout(timer);
        timer = setTimeout(function () {
          timer = null;
          suppressClickUntil = Date.now() + 700;
          suppressNativeMenuUntil = Date.now() + 1000;
          if (navigator.vibrate) navigator.vibrate(15);
          cell.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: startXY[0], clientY: startXY[1], button: 2 })
          );
        }, 450);
      },
      true
    );
    var cancel = function (e) {
      if (!timer) return;
      if (e.type === 'pointermove' && startXY && Math.hypot(e.clientX - startXY[0], e.clientY - startXY[1]) < 10) return;
      clearTimeout(timer);
      timer = null;
    };
    ['pointerup', 'pointercancel', 'pointermove'].forEach((t) => document.addEventListener(t, cancel, true));
    document.addEventListener(
      'click',
      function (e) {
        if (Date.now() < suppressClickUntil && e.target.closest && e.target.closest(CELL)) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true
    );
    document.addEventListener(
      'contextmenu',
      function (e) {
        // Android also fires its own long-press menu event: ignore it after ours
        if (e.isTrusted && Date.now() < suppressNativeMenuUntil) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true
    );
  })();

  // Ben: keep popup menus inside the screen (phones)
  var originalShowContextMenu = root.myGrooveUtils.showContextMenu;
  root.myGrooveUtils.showContextMenu = function (menu) {
    var ret = originalShowContextMenu.apply(this, arguments);
    if (menu && menu.getBoundingClientRect) {
      var r = menu.getBoundingClientRect();
      var left = Math.min(Math.max(8, r.left), window.innerWidth - r.width - 8);
      var top = Math.min(Math.max(8, r.top), window.innerHeight - r.height - 8);
      menu.style.left = Math.max(8, left) + 'px';
      menu.style.top = Math.max(8, top) + 'px';
    }
    return ret;
  };

  // ---------------------------------------------------------------------
  // Ben: title / author / comment only matter for print & download, so they
  // live in a small dialog that opens when you print or download.
  // ---------------------------------------------------------------------
  function sheetDetailsDialog(actionLabel, onGo) {
    var fields = document.getElementById('sheetMusicTextFields');
    var dlg = document.getElementById('benDetailsDialog');
    if (!dlg) {
      dlg = document.createElement('div');
      dlg.id = 'benDetailsDialog';
      dlg.innerHTML =
        '<div class="ben-dlg-card"><div class="ben-dlg-title">Sheet details</div>' +
        '<div class="ben-dlg-sub">Optional: shown on top of the printed / downloaded sheet.</div>' +
        '<div class="ben-dlg-fields"></div>' +
        '<div class="ben-dlg-buttons"><button class="ben-dlg-cancel">Cancel</button></div></div>';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) dlg.style.display = 'none';
      });
      dlg.querySelector('.ben-dlg-cancel').onclick = function () {
        dlg.style.display = 'none';
      };
    }
    if (fields && fields.parentNode !== dlg.querySelector('.ben-dlg-fields')) dlg.querySelector('.ben-dlg-fields').appendChild(fields);
    // actionLabel/onGo may be a single action or a list of [label, fn] pairs
    var actions = Array.isArray(actionLabel) ? actionLabel : [[actionLabel, onGo]];
    var box = dlg.querySelector('.ben-dlg-buttons');
    box.querySelectorAll('.ben-dlg-go').forEach((b) => b.remove());
    actions.forEach(function (a) {
      var go = document.createElement('button');
      go.className = 'ben-dlg-go';
      go.textContent = a[0];
      go.onclick = function () {
        dlg.style.display = 'none';
        root.refresh_ABC();
        setTimeout(a[1], 50);
      };
      box.appendChild(go);
    });
    dlg.style.display = 'flex';
    var first = document.getElementById('tuneTitle');
    if (first && window.innerWidth > 720) first.focus();
  }
  // Ben: print on A4 portrait, 2 bars per line, only the sheet music
  root._benPrintLayout = false;
  // a small, friendly thank-you after a print or download (at most once per visit)
  function benThanks() {
    try {
      if (sessionStorage.getItem('benThanked')) return;
      sessionStorage.setItem('benThanked', '1');
    } catch (e) {
      /* ignore */
    }
    var t = document.createElement('div');
    t.id = 'benThanks';
    t.innerHTML =
      '<span>Sheet ready! Drumsheet is free, so a coffee is always welcome.</span>' +
      '<a href="https://ko-fi.com/gladinathor" target="_blank" rel="noopener">&#9749; Buy me a coffee</a>' +
      '<button aria-label="Close">&times;</button>';
    t.querySelector('button').onclick = function () {
      t.remove();
    };
    document.body.appendChild(t);
    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () {
        t.remove();
      }, 400);
    }, 9000);
  }

  function printSheetPortrait() {
    root._benPrintLayout = true;
    root.refresh_ABC();
    var svgs = Array.prototype.map
      .call(document.querySelectorAll('#svgTarget svg'), function (el) {
        return el.outerHTML;
      })
      .join('\n');
    root._benPrintLayout = false;
    root.refresh_ABC();
    var title = (document.getElementById('tuneTitle') || {}).value || 'Drumsheet';
    var html =
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
      title.replace(/</g, '&lt;') +
      '</title><style>@page{size:A4 portrait;margin:14mm}html,body{margin:0;background:#fff}' +
      'svg{display:block;width:100%;height:auto;margin:0 0 4mm}</style></head><body>' +
      svgs +
      '</body></html>';
    var frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    frame.onload = function () {
      setTimeout(function () {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        benThanks();
        setTimeout(function () {
          frame.remove();
        }, 2000);
      }, 100);
    };
    frame.srcdoc = html;
  }
  root.printMusic = function () {
    sheetDetailsDialog('Print', printSheetPortrait);
    var sub = document.querySelector('#benDetailsDialog .ben-dlg-sub');
    if (sub) sub.textContent = 'Optional: shown on top of the printed sheet.';
  };
  root.DownloadAnchorClick = function () {
    sheetDetailsDialog([
      ['PDF', function () { printSheetPortrait(); }],
      ['PNG image', function () { exportPngImage(); }],
      ['Audio (WAV)', function () { exportAudioWav(); }],
      ['MIDI file', function () { root.MIDISaveAs(); }],
    ]);
    var sub = document.querySelector('#benDetailsDialog .ben-dlg-sub');
    if (sub)
      sub.textContent =
        'Optional: shown on top of the sheet. PDF opens the print window: choose "Save as PDF". Audio plays the groove 4 times, with the metronome if it is on.';
  };

  // Ben: one PNG with all lines of the sheet, on a white background (2 bars per line like print)
  function exportPngImage() {
    root._benPrintLayout = true;
    root.refresh_ABC();
    var svgs = Array.prototype.slice.call(document.querySelectorAll('#svgTarget svg')).map((el) => el.cloneNode(true));
    root._benPrintLayout = false;
    root.refresh_ABC();
    var W = 1600;
    var pad = 40;
    var parts = svgs
      .map(function (el) {
        var vb = (el.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
        if (vb.length !== 4 || !vb[2]) return null;
        var h = Math.round((vb[3] * (W - 2 * pad)) / vb[2]);
        el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        el.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        el.setAttribute('width', W - 2 * pad);
        el.setAttribute('height', h);
        return { svg: new XMLSerializer().serializeToString(el), h: h };
      })
      .filter(Boolean);
    if (!parts.length) return;
    var H = parts.reduce((a, p) => a + p.h + 16, 2 * pad);
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var g = canvas.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    var y = pad;
    var load = parts.map(function (p) {
      return new Promise(function (resolve) {
        var img = new Image();
        var url = URL.createObjectURL(new Blob([p.svg], { type: 'image/svg+xml' }));
        img.onload = function () {
          resolve({ img: img, h: p.h, url: url });
        };
        img.onerror = function () {
          resolve(null);
        };
        img.src = url;
      });
    });
    Promise.all(load).then(function (imgs) {
      imgs.forEach(function (it, i) {
        if (it) {
          g.drawImage(it.img, pad, y, W - 2 * pad, it.h);
          URL.revokeObjectURL(it.url);
        }
        y += parts[i].h + 16;
      });
      canvas.toBlob(function (blob) {
        var a = document.createElement('a');
        var title = ((document.getElementById('tuneTitle') || {}).value || 'drumsheet').trim().replace(/[^\w\- ]+/g, '');
        a.href = URL.createObjectURL(blob);
        a.download = (title || 'drumsheet') + '.png';
        document.body.appendChild(a);
        a.click();
        benThanks();
        setTimeout(function () {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 4000);
      }, 'image/png');
    });
  }
  root.exportPngImage = exportPngImage;

  // Ben: render the groove to a WAV file in the browser (same drum samples as playback)
  function exportAudioWav() {
    var repeats = 4;
    root._benExportAll = true;
    var midiUrl;
    try {
      midiUrl = createMidiUrlFromClickableUI('our_MIDI');
    } finally {
      root._benExportAll = false;
    }
    var bin = atob(midiUrl.split('base64,')[1]);
    var events = new Replayer(MidiFile(bin), 1).getData();
    var hits = [];
    var t = 0;
    events.forEach(function (ev) {
      t += ev[1] / 1000;
      var e = ev[0].event;
      if (e.subtype === 'noteOn' && e.velocity > 0) hits.push([t, e.noteNumber, e.velocity]);
    });
    var loopLen = t;
    if (!hits.length || loopLen <= 0) {
      alert('Nothing to export: the groove is empty.');
      return;
    }
    var font = (window.MIDI && MIDI.Soundfont && (MIDI.Soundfont.gunshot || MIDI.Soundfont[Object.keys(MIDI.Soundfont)[0]])) || {};
    var sr = 44100;
    var total = loopLen * repeats + 2;
    var ctx = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
    var notes = Array.from(new Set(hits.map((h) => h[1])));
    Promise.all(
      notes.map(function (n) {
        var key = MIDI.noteToKey[n];
        var data = key && font[key];
        if (!data) return Promise.resolve([n, null]);
        return fetch(data)
          .then((r) => r.arrayBuffer())
          .then((buf) => ctx.decodeAudioData(buf))
          .then((ab) => [n, ab])
          .catch(() => [n, null]);
      })
    )
      .then(function (decoded) {
        var buffers = {};
        decoded.forEach((d) => (buffers[d[0]] = d[1]));
        for (var r = 0; r < repeats; r++) {
          hits.forEach(function (h) {
            var b = buffers[h[1]];
            if (!b) return;
            var src = ctx.createBufferSource();
            src.buffer = b;
            var g = ctx.createGain();
            g.gain.value = Math.min(1, h[2] / 127);
            src.connect(g);
            g.connect(ctx.destination);
            src.start(r * loopLen + h[0]);
          });
        }
        return ctx.startRendering();
      })
      .then(function (audio) {
        var blob = audioBufferToWav(audio);
        var a = document.createElement('a');
        var title = ((document.getElementById('tuneTitle') || {}).value || 'drumsheet').trim().replace(/[^\w\- ]+/g, '');
        a.href = URL.createObjectURL(blob);
        a.download = (title || 'drumsheet') + '.wav';
        document.body.appendChild(a);
        a.click();
        benThanks();
        setTimeout(function () {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 4000);
      })
      .catch(function (err) {
        alert('Sorry, the audio export failed: ' + err);
      });
  }
  root.exportAudioWav = exportAudioWav;

  function audioBufferToWav(audio) {
    var ch = audio.numberOfChannels;
    var len = audio.length;
    var peak = 0;
    var chans = [];
    for (var c = 0; c < ch; c++) {
      chans.push(audio.getChannelData(c));
      for (var i = 0; i < len; i++) peak = Math.max(peak, Math.abs(chans[c][i]));
    }
    var norm = peak > 0.98 ? 0.98 / peak : 1; // avoid clipping when many notes hit together
    var buf = new ArrayBuffer(44 + len * ch * 2);
    var v = new DataView(buf);
    var w = (o, str) => str.split('').forEach((x, k) => v.setUint8(o + k, x.charCodeAt(0)));
    w(0, 'RIFF');
    v.setUint32(4, 36 + len * ch * 2, true);
    w(8, 'WAVE');
    w(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, ch, true);
    v.setUint32(24, audio.sampleRate, true);
    v.setUint32(28, audio.sampleRate * ch * 2, true);
    v.setUint16(32, ch * 2, true);
    v.setUint16(34, 16, true);
    w(36, 'data');
    v.setUint32(40, len * ch * 2, true);
    var o = 44;
    for (var j = 0; j < len; j++)
      for (var k = 0; k < ch; k++) {
        var x = Math.max(-1, Math.min(1, chans[k][j] * norm));
        v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
        o += 2;
      }
    return new Blob([buf], { type: 'audio/wav' });
  }

  var originalABCHighlight = root.myGrooveUtils.highlightNoteInABCSVGFromPercentComplete;
  root.myGrooveUtils.highlightNoteInABCSVGFromPercentComplete = function (percentComplete) {
    if (class_permutation_type != 'none' || !class_play_timeline.length)
      return originalABCHighlight(percentComplete);
    var pos = timelinePosition(percentComplete);
    var map = root.myGrooveUtils.note_mapping_array;
    if (!pos || !map) return;
    var mapIdx = (class_bar_map_start[pos.bar] || 0) + Math.floor(pos.slot + 1e-6);
    var real = -1;
    for (var i = 0; i <= mapIdx && i < map.length; i++) if (map[i]) real++;
    root.myGrooveUtils.highlightNoteInABCSVGByIndex(real);
  };

  // "+" button: choose between a copy of the last bar or an empty bar
  function closeAddBarMenu() {
    var menu = document.getElementById('benAddBarMenu');
    if (menu) menu.remove();
  }

  root.addMeasureButtonClick = function (event) {
    closeAddBarMenu();
    var menu = document.createElement('div');
    menu.id = 'benAddBarMenu';
    menu.className = 'ben-add-bar-menu';
    menu.innerHTML =
      '<button onclick="myGrooveWriter.addBar(\'copy\')"><i class="fa fa-clone"></i> Copy of last bar</button>' +
      '<button onclick="myGrooveWriter.addBar(\'empty\')"><i class="fa fa-square-o"></i> Empty bar</button>' +
      '<button onclick="document.getElementById(\'benAddBarMenu\').remove()">Cancel</button>';
    var x = event && event.clientX ? event.clientX : window.innerWidth / 2;
    var y = event && event.clientY ? event.clientY : window.innerHeight / 2;
    document.body.appendChild(menu);
    var mr = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x - mr.width / 2, window.innerWidth - mr.width - 8)) + 'px';
    var top = y + 12;
    if (top + mr.height > window.innerHeight - 8) top = Math.max(8, y - mr.height - 12); // open upwards
    menu.style.top = top + 'px';
  };

  root.closeMeasureButtonClick = function (measureNum) {
    root.deleteBar(measureNum - 1);
  };

  // public function
  // function to create HTML for the music staff and notes.   We usually want more than one of these
  // baseIndex is the index for the css labels "staff-container1, staff-container2"
  // indexStartForNotes is the index for the note ids.
  root.HTMLforStaffContainer = function (baseindex, indexStartForNotes) {
    return _view.buildStaffContainerHTML(baseindex, indexStartForNotes, {
      notesPerMeasure: class_notes_per_measure,
      numBeatsPerMeasure: class_num_beats_per_measure,
      noteValuePerMeasure: class_note_value_per_measure,
      numberOfMeasures: class_number_of_measures,
      noteGrouping: root.myGrooveUtils.noteGroupingSize(
        class_notes_per_measure,
        class_num_beats_per_measure,
        class_note_value_per_measure
      ),
    });
  };

  // a click on a permutation option checkbox
  root.permutationOptionClick = function (event) {
    var optionId = event.target.id;
    var checkbox = document.getElementById(optionId);
    var OnElseOff = checkbox.checked;

    for (var i = 1; i < 5; i++) {
      var subOption = optionId + '_sub' + i;

      checkbox = document.getElementById(subOption);
      if (checkbox) checkbox.checked = OnElseOff;
    }

    root.refresh_ABC();
  };

  // a click on a permutation sub option checkbox
  root.permutationSubOptionClick = function (event) {
    var optionId = event.target.id;
    var checkbox = document.getElementById(optionId);
    var OnElseOff = checkbox.checked;

    if (OnElseOff) {
      // only do this if turning a sub option on
      // remove the "_sub" and the number on the end (the last char)
      var mainOption = optionId.replace('_sub', '').slice(0, -1);

      checkbox = document.getElementById(mainOption);
      if (checkbox) checkbox.checked = true;
    }

    root.refresh_ABC();
  };

  // public function
  // function to create HTML for the music staff and notes.   We usually want more than one of these
  // baseIndex is the index for the css labels "staff-container1, staff-container2"
  // indexStartForNotes is the index for the note ids.
  root.HTMLforPermutationOptions = function () {
    return _view.buildPermutationOptionsHTML(class_permutation_type, usingTriplets());
  };
} // end of class

export { GrooveWriter };
