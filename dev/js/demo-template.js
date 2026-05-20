/**
 * Grundriss Tool – Demo-Daten Template
 * =====================================================================
 * @module demoTemplate
 * @description Enthält Demo-Raumdaten, die beim Erstellen eines neuen
 * Projekts automatisch geladen werden. Jedes Projekt erhält eine
 * unabhängige Kopie dieser Daten.
 */
window.GR = window.GR || {};

(function(DT) {
  'use strict';

  /**
   * Demo-Räume für EG (Erdgeschoss).
   * Werden in jedes neue Projekt als Startvorlage kopiert.
   */
  var demoRoomsEg = {
    'raum': {
      title: 'Büro',
      floor: 'eg',
      left: 100,
      top: 80,
      width: 200,
      height: 150,
      tasks: ['Schreibtisch aufräumen', 'Kabelmanagement', 'Whiteboard aufhängen'],
      done: { 0: false, 1: false, 2: false },
      comments: [],
      note: ''
    },
    'raum1': {
      title: 'Konferenzraum',
      floor: 'eg',
      left: 350,
      top: 80,
      width: 250,
      height: 180,
      tasks: ['Beamer testen', 'Stühle zählen', 'Whiteboard reinigen'],
      done: { 0: false, 1: false, 2: false },
      comments: [],
      note: 'Platz für 12 Personen'
    },
    'raum2': {
      title: 'Küche',
      floor: 'eg',
      left: 650,
      top: 100,
      width: 180,
      height: 120,
      tasks: ['Kaffeemaschine entkalken', 'Kühlschrank aufräumen'],
      done: { 0: true, 1: false },
      comments: [],
      note: ''
    },
    'raum3': {
      title: 'Empfang',
      floor: 'eg',
      left: 100,
      top: 300,
      width: 300,
      height: 140,
      tasks: ['Blumen gießen', 'Besucherausweise bestellen'],
      done: { 0: false, 1: false },
      comments: [],
      note: 'Öffnungszeiten: 8-18 Uhr'
    },
    'raum4': {
      title: 'Lagerraum',
      floor: 'eg',
      left: 650,
      top: 280,
      width: 200,
      height: 160,
      tasks: ['Inventur', 'Regale aufräumen', 'Lüftung prüfen'],
      done: { 0: false, 1: false, 2: false },
      comments: [],
      note: ''
    }
  };

  /**
   * Demo-Räume für OG (Obergeschoss).
   */
  var demoRoomsOg = {
    'raum5': {
      title: 'Meetingraum',
      floor: 'og',
      left: 80,
      top: 60,
      width: 180,
      height: 140,
      tasks: ['Videokonferenz-Setup', 'Tisch reservieren'],
      done: { 0: false, 1: false },
      comments: [],
      note: ''
    },
    'raum6': {
      title: 'Fokus-Raum',
      floor: 'og',
      left: 300,
      top: 60,
      width: 150,
      height: 120,
      tasks: ['Schalldämmung prüfen'],
      done: { 0: false },
      comments: [],
      note: 'Bitte leise sein!'
    },
    'raum7': {
      title: 'Büro 2',
      floor: 'og',
      left: 500,
      top: 80,
      width: 200,
      height: 150,
      tasks: ['Monitore aufstellen', 'Netzwerk testen', 'Schreibtischstuhl bestellen'],
      done: { 0: false, 1: true, 2: false },
      comments: [],
      note: ''
    }
  };

  /**
   * Gibt eine tiefe Kopie aller Demo-Räume zurück.
   * Die Räume werden auf die angegebenen Floor-IDs gemappt.
   * @param {Array<{id: string, name: string}>} floors - Array der Floor-IDs
   * @returns {Object} Demo-Räume, kopiert und auf Floors gemappt
   */
  DT.getDemoRooms = function(floors) {
    var U = window.GR.utils;
    var rooms = {};
    var keyCounter = 0;

    // Map demo rooms to the first two floors of the project
    var floorId1 = floors.length > 0 ? floors[0].id : 'floor0';
    var floorId2 = floors.length > 1 ? floors[1].id : null;

    // EG demo rooms → first floor
    var egRooms = U.deepClone(demoRoomsEg);
    for (var k of Object.keys(egRooms)) {
      egRooms[k].floor = floorId1;
      rooms[k] = egRooms[k];
    }

    // OG demo rooms → second floor (if exists)
    if (floorId2) {
      var ogRooms = U.deepClone(demoRoomsOg);
      for (var k2 of Object.keys(ogRooms)) {
        ogRooms[k2].floor = floorId2;
        rooms[k2] = ogRooms[k2];
      }
    }

    return rooms;
  };
})(window.GR.demoTemplate = window.GR.demoTemplate || {});