/**
 * Grundriss Tool – Berechtigungen
 * =====================================================================
 * @module permissions
 * @description Zentrale Berechtigungslogik fuer Rollen- und EditMode-Checks.
 */
window.GR = window.GR || {};

(function(Perm) {
  'use strict';

  var S = window.GR.state;

  /** Role check: Owner oder Editor. */
  Perm.canEdit = function() {
    var role = S.get('currentProjectRole');
    return role === 'owner' || role === 'editor';
  };

  /** Content editing: Tasks abhaken/loeschen, Kommentare schreiben/loeschen. editMode + Role. */
  Perm.canEditContent = function() {
    return S.get('editMode') && Perm.canEdit();
  };

  /** Spatial editing: Raeume ziehen/erstellen/loeschen, Notizen, neue Aufgaben. editMode + Role. */
  Perm.canEditSpatial = function() {
    return S.get('editMode') && Perm.canEdit();
  };

  /** Alias fuer canEditSpatial — verwendet in drag/resize/place-room. */
  Perm.requireEdit = function() {
    return S.get('editMode') && Perm.canEdit();
  };

})(window.GR.permissions = window.GR.permissions || {});
