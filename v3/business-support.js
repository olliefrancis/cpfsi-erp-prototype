/* Business Support workflow — advice and dialogue with premises (not audit, CPIN or concern) */
(function () {
  'use strict';

  const BS_OVERRIDE_KEY = 'biz-support-overrides-v1';
  const BS_CURRENT_INSPECTOR = 'Phil Gower';

  const BS_PREMISES = {
    'Temple Quay House': { ref: 'PRM-0001847', meta: 'Temple Back East, Bristol BS1 6BH  ·  Government office  ·  HMCTS', initials: 'TQ', score: 47 },
    'Royal Courts of Justice': { ref: 'PRM-0000921', meta: 'Strand, London WC2A 2LL  ·  Courts  ·  MoJ', initials: 'RC', score: 22 },
    'MoJ HQ London': { ref: 'PRM-0000102', meta: '102 Petty France, London SW1H 9AJ  ·  Government office  ·  MoJ', initials: 'MJ', score: 19 },
    'HMP Bristol': { ref: 'PRM-0002140', meta: 'Cambridge Grove, Bristol BS7  ·  Prison · Cat B', initials: 'HB', score: 44 }
  };

  const BS_DH_BY_PREMISES = {
    'Temple Quay House': ['HMCTS', 'Equans', 'Property Directorate'],
    'Royal Courts of Justice': ['Ministry of Justice Property', 'Mitie'],
    'MoJ HQ London': ['Ministry of Justice Property', 'Equans'],
    'HMP Bristol': ['HMPPS - South West', 'Serco FM']
  };

  const BS_MODE_LABELS = { in_person: 'In person', call: 'Phone call', video: 'Video call', email: 'Email / correspondence' };

  const BS_BASE = [
    {
      id: 'bs-0044', ref: 'B-2026-0044', premises: 'Royal Courts of Justice', workflow: 'conduct',
      purpose: 'Fire compartmentation advice ahead of refurbishment',
      openedAt: '7 Jun 2026',
      appointment: { date: '2026-06-25', time: '10:00', mode: 'in_person', duration: 'half', confirmed: true, letterSkipped: false, letterSent: true },
      inspectors: [{ id: 'ins-lead', name: 'Phil Gower', role: 'Lead Fire Safety Inspector', initials: 'PG', isLead: true }],
      dutyHolders: [{ id: 'dh-mojp', key: 'mojprop', name: 'Ministry of Justice Property', role: 'Government department  ·  Property', initials: 'MP', fromPremises: true, status: 'accepted' }],
      responsiblePersons: [{ id: 'rp-jh', key: 'jhowell', name: 'James Howell', role: 'Property Officer  ·  MoJ', initials: 'JH', fromPremises: true, status: 'accepted', linkedDh: 'mojprop' }],
      furtherRequired: null, followUp: null, closeReason: null,
      activityLog: {
        notes: [{ id: 'bn1', text: 'Business support opened — meeting scheduled 25 Jun.', at: '7 Jun 2026', ts: 1717718400000 }],
        times: [], files: []
      }
    },
    {
      id: 'bs-0039', ref: 'B-2026-0039', premises: 'MoJ HQ London', workflow: 'conduct',
      purpose: 'Workshop prep — fire safety initiative for regional leads',
      openedAt: '30 May 2026',
      appointment: { date: '2026-07-12', time: '14:00', mode: 'in_person', duration: 'full', confirmed: true, letterSkipped: true, letterSent: false },
      inspectors: [
        { id: 'ins-lead', name: 'Phil Gower', role: 'Lead Fire Safety Inspector', initials: 'PG', isLead: true },
        { id: 'ins-sc', name: 'Sarah Chen', role: 'Fire Safety Inspector', initials: 'SC', isLead: false }
      ],
      dutyHolders: [{ id: 'dh-moj', key: 'mojprop', name: 'Ministry of Justice Property', role: 'Government department', initials: 'MP', fromPremises: true, status: 'accepted' }],
      responsiblePersons: [],
      furtherRequired: null, followUp: null, closeReason: null,
      conductNotes: 'Slides drafted for workshop. Awaiting DH attendee list.',
      activityLog: {
        notes: [{ id: 'bn2', text: 'Prep call with DH — 12 Jul workshop confirmed.', at: '1 Jun 2026', ts: 1717200000000 }],
        times: [{ id: 'bt1', activity: 'Phone call', minutes: 45, at: '1 Jun 2026', ts: 1717203600000 }],
        files: []
      }
    },
    {
      id: 'bs-tq-closed', ref: 'BS-2026-0088', premises: 'Temple Quay House', workflow: 'closed',
      purpose: 'Fire door training discussion',
      openedAt: '2 May 2026', closedAt: '2 May 2026',
      appointment: { date: '2026-05-02', time: '11:00', mode: 'call', duration: 'half', confirmed: true, letterSkipped: true, letterSent: false },
      inspectors: [{ id: 'ins-lead', name: 'Phil Gower', role: 'Lead Fire Safety Inspector', initials: 'PG', isLead: true }],
      dutyHolders: [{ id: 'dh-eq', name: 'Equans', role: 'FM company', initials: 'EQ', fromPremises: true, status: 'accepted' }],
      responsiblePersons: [],
      furtherRequired: 'no', closeReason: 'Advice given on fire door maintenance regime — no further action.',
      activityLog: { notes: [{ id: 'bn0', text: 'Call with Equans FM — training materials shared.', at: '2 May 2026', ts: 1714640400000 }], times: [{ id: 'bt0', activity: 'Phone call', minutes: 30, at: '2 May 2026', ts: 1714644000000 }], files: [] }
    }
  ];

  let bsOverrides = {};
  let activeBizSupportId = null;
  let bsLogType = 'time';
  let bsActivityLog = { notes: [], times: [], files: [] };

  function loadBsOverrides() {
    try {
      const raw = localStorage.getItem(BS_OVERRIDE_KEY);
      if (raw) bsOverrides = JSON.parse(raw);
    } catch (e) { bsOverrides = {}; }
  }

  function saveBsOverrides() {
    localStorage.setItem(BS_OVERRIDE_KEY, JSON.stringify(bsOverrides));
  }

  function getAllBsRecords() {
    const seen = new Set();
    const out = [];
    BS_BASE.forEach(function (r) {
      if (seen.has(r.id)) return;
      seen.add(r.id);
      out.push(mergeBsRecord(r));
    });
    Object.keys(bsOverrides).forEach(function (id) {
      if (seen.has(id)) return;
      if (bsOverrides[id]._deleted) return;
      seen.add(id);
      out.push(bsOverrides[id]);
    });
    return out;
  }

  function mergeBsRecord(base) {
    return Object.assign({}, base, bsOverrides[base.id] || {});
  }

  function getBizSupportById(id) {
    const base = BS_BASE.find(function (r) { return r.id === id; });
    if (base) return mergeBsRecord(base);
    return bsOverrides[id] && !bsOverrides[id]._deleted ? Object.assign({}, bsOverrides[id]) : null;
  }

  function persistBsPatch(id, patch) {
    const existing = getBizSupportById(id) || bsOverrides[id] || {};
    bsOverrides[id] = Object.assign({}, existing, patch, { id: id });
    saveBsOverrides();
  }

  function bsWorkflowStage(rec) {
    if (!rec || rec.workflow === 'closed') return 3;
    if (rec.workflow === 'conduct') return 2;
    return 1;
  }

  function bsHasAcceptedDutyHolders(rec) {
    return (rec.dutyHolders || []).some(function (d) { return d.status === 'accepted'; });
  }

  function bsSetupComplete(rec) {
    if (!rec || !rec.premises) return false;
    const apt = rec.appointment || {};
    return !!(apt.date && apt.time && apt.confirmed && bsHasAcceptedDutyHolders(rec));
  }

  function bsCanStartSession(rec) {
    return rec && rec.workflow === 'setup' && bsSetupComplete(rec);
  }

  function bsCanClose(rec) {
    if (!rec || rec.workflow === 'closed') return false;
    if (rec.workflow === 'setup') return false;
    if (!rec.furtherRequired) return false;
    if (rec.furtherRequired === 'yes') {
      const fu = rec.followUp || {};
      return !!(fu.date && fu.mode && fu.purpose);
    }
    return true;
  }

  function defaultBsRecord(id, premisesName) {
    const prem = BS_PREMISES[premisesName] || { ref: '', meta: '', initials: 'PR', score: null };
    const nextRef = 'B-2026-' + String(450 + Object.keys(bsOverrides).length).padStart(4, '0');
    return {
      id: id,
      ref: nextRef,
      premises: premisesName,
      workflow: 'setup',
      purpose: '',
      openedAt: 'Today',
      appointment: { date: '', time: '', mode: 'in_person', duration: 'half', confirmed: false, letterSkipped: false, letterSent: false },
      inspectors: [{ id: 'ins-lead', name: BS_CURRENT_INSPECTOR, role: 'Lead Fire Safety Inspector', initials: 'PG', isLead: true }],
      dutyHolders: [],
      responsiblePersons: [],
      furtherRequired: null,
      followUp: null,
      closeReason: null,
      activityLog: { notes: [{ id: 'bn-new', text: 'Business support process created from premises.', at: 'Today', ts: Date.now() }], times: [], files: [] },
      _premMeta: prem
    };
  }

  function ensureBsDutyHolderSuggestions(rec) {
    const fromMap = BS_DH_BY_PREMISES[rec.premises] || [];
    const holders = (rec.dutyHolders || []).slice();
    const onList = new Set(holders.map(function (d) { return d.name; }));
    let changed = false;
    fromMap.forEach(function (name) {
      if (onList.has(name)) return;
      holders.push({
        id: 'dh-' + name.replace(/\W+/g, '-').toLowerCase(),
        key: typeof SETUP_DH_KEY_BY_NAME !== 'undefined' ? SETUP_DH_KEY_BY_NAME[name] : null,
        name: name,
        role: 'Duty Holder',
        initials: typeof setupInitials === 'function' ? setupInitials(name) : 'DH',
        fromPremises: true,
        status: 'suggested'
      });
      onList.add(name);
      changed = true;
    });
    if (changed) persistBsPatch(rec.id, { dutyHolders: holders });
  }

  function renderBsPremisesCard(rec) {
    const prem = BS_PREMISES[rec.premises] || rec._premMeta || {};
    const el = document.getElementById('bs-premises-card');
    if (!el || !rec.premises) return;
    const scoreHtml = prem.score != null ? '<span class="pill blue">RBIP score ' + prem.score + '</span>' : '';
    el.innerHTML =
      '<div class="holder-card" style="background:var(--accent-soft);border-color:var(--accent);">' +
        '<div class="avatar-sm" style="background:var(--accent);color:white;">' + escHtml(prem.initials || 'PR') + '</div>' +
        '<div><div class="name">' + escHtml(rec.premises) + '</div>' +
        '<div class="role">' + escHtml(prem.meta || '') + (prem.ref ? '  ·  <span class="prem-ref">' + escHtml(prem.ref) + '</span>' : '') + '</div></div>' +
        scoreHtml +
      '</div>';
  }

  function renderBsTeam(rec) {
    const extra = document.getElementById('bs-team-extra');
    if (!extra) return;
    const others = (rec.inspectors || []).filter(function (i) { return !i.isLead; });
    extra.innerHTML = others.map(function (ins) {
      return '<div class="holder-card"><div class="avatar-sm">' + escHtml(ins.initials) + '</div>' +
        '<div><div class="name">' + escHtml(ins.name) + '</div><div class="role">' + escHtml(ins.role) + '</div></div>' +
        '<span class="remove" onclick="removeBsInspector(\'' + ins.id + '\')">×</span></div>';
    }).join('');
    const sum = document.getElementById('bs-sum-inspectors');
    if (sum) sum.textContent = others.length ? others.map(function (i) { return i.name; }).join(', ') : 'none';
  }

  function renderBsDutyHolders(rec) {
    const list = document.getElementById('bs-dh-list');
    if (!list) return;
    const holders = (rec.dutyHolders || []).filter(function (d) { return d.status !== 'rejected'; });
    if (!holders.length) {
      list.innerHTML = '<p style="color:var(--ink-3);font-size:13px;">Suggested Duty Holders appear when premises is set.</p>';
      return;
    }
    list.innerHTML = holders.map(function (dh) {
      const pill = dh.status === 'suggested' ? '<span class="pill amber">Suggested</span>' : '<span class="pill blue">Approved</span>';
      const actions = dh.status === 'suggested'
        ? '<div class="holder-actions"><button class="btn primary" type="button" onclick="acceptBsDutyHolder(\'' + dh.id + '\')">Approve</button><button class="btn" type="button" onclick="removeBsDutyHolder(\'' + dh.id + '\')">Reject</button></div>'
        : '<div class="holder-actions"><span class="remove" onclick="removeBsDutyHolder(\'' + dh.id + '\')">×</span></div>';
      return '<div class="holder-card' + (dh.status === 'suggested' ? ' is-suggested' : '') + '">' +
        '<div class="avatar-sm">' + escHtml(dh.initials || 'DH') + '</div>' +
        '<div><div class="name">' + escHtml(dh.name) + '</div><div class="role">' + escHtml(dh.role || '') + '</div></div>' +
        pill + actions + '</div>';
    }).join('');
    const sum = document.getElementById('bs-sum-dh');
    if (sum) sum.textContent = String(holders.filter(function (d) { return d.status === 'accepted'; }).length);
  }

  function renderBsResponsiblePersons(rec) {
    const list = document.getElementById('bs-rp-list');
    if (!list) return;
    const rps = rec.responsiblePersons || [];
    if (!rps.length) {
      list.innerHTML = '<p style="color:var(--ink-3);font-size:13px;">Approve Duty Holders first — Responsible Persons are suggested for each.</p>';
      return;
    }
    list.innerHTML = rps.map(function (rp) {
      const pill = rp.status === 'suggested' ? '<span class="pill amber">Suggested</span>' : '<span class="pill blue">Approved</span>';
      const actions = rp.status === 'suggested'
        ? '<div class="holder-actions"><button class="btn primary" type="button" onclick="acceptBsResponsiblePerson(\'' + rp.id + '\')">Approve</button><button class="btn" type="button" onclick="removeBsResponsiblePerson(\'' + rp.id + '\')">Reject</button></div>'
        : '<div class="holder-actions"><span class="remove" onclick="removeBsResponsiblePerson(\'' + rp.id + '\')">×</span></div>';
      return '<div class="holder-card' + (rp.status === 'suggested' ? ' is-suggested' : '') + '">' +
        '<div class="avatar-sm">' + escHtml(rp.initials || 'RP') + '</div>' +
        '<div><div class="name">' + escHtml(rp.name) + '</div><div class="role">' + escHtml(rp.role || '') + '</div></div>' +
        pill + actions + '</div>';
    }).join('');
    const sum = document.getElementById('bs-sum-rp');
    if (sum) sum.textContent = String(rps.filter(function (r) { return r.status === 'accepted'; }).length);
  }

  function renderBsAppointmentFields(rec) {
    const apt = rec.appointment || {};
    const date = document.getElementById('bs-apt-date');
    const time = document.getElementById('bs-apt-time');
    const mode = document.getElementById('bs-apt-mode');
    const dur = document.getElementById('bs-apt-duration');
    const purpose = document.getElementById('bs-purpose');
    const confirmed = document.getElementById('bs-apt-confirmed');
    if (date) date.value = apt.date || '';
    if (time) time.value = apt.time || '';
    if (mode) mode.value = apt.mode || 'in_person';
    if (dur) dur.value = apt.duration || 'half';
    if (purpose) purpose.value = rec.purpose || '';
    if (confirmed) confirmed.checked = !!apt.confirmed;
    const sumAppt = document.getElementById('bs-sum-appt');
    if (sumAppt) {
      if (apt.date && apt.time) {
        const d = new Date(apt.date + 'T' + apt.time);
        sumAppt.textContent = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + apt.time + '  ·  ' + (BS_MODE_LABELS[apt.mode] || apt.mode);
      } else {
        sumAppt.textContent = 'Not set';
      }
    }
    const letterStatus = document.getElementById('bs-letter-status');
    if (letterStatus) {
      if (apt.letterSent) letterStatus.textContent = 'Appointment letter sent.';
      else if (apt.letterSkipped) letterStatus.textContent = 'Letter skipped — informal call or email.';
      else letterStatus.textContent = '';
    }
  }

  function renderBsStageRail(rec) {
    const stage = bsWorkflowStage(rec);
    document.querySelectorAll('#bs-stage-rail .stage').forEach(function (el, i) {
      const n = i + 1;
      el.classList.remove('current', 'done', 'future');
      if (rec.workflow === 'closed') el.classList.add('done');
      else if (n < stage) el.classList.add('done');
      else if (n === stage) el.classList.add('current');
      else el.classList.add('future');
    });
  }

  function renderBsWorkflowSections(rec) {
    const setup = document.getElementById('bs-section-setup');
    const conduct = document.getElementById('bs-section-conduct');
    const closeSec = document.getElementById('bs-section-close');
    const startBtn = document.getElementById('bs-start-btn');
    const startBlocked = document.getElementById('bs-start-blocked');
    const isClosed = rec.workflow === 'closed';

    if (setup) setup.hidden = isClosed || rec.workflow !== 'setup';
    if (conduct) conduct.hidden = isClosed || rec.workflow === 'setup';
    if (closeSec) closeSec.hidden = isClosed ? false : rec.workflow === 'setup';

    if (startBtn) startBtn.disabled = !bsCanStartSession(rec);
    if (startBlocked) {
      startBlocked.hidden = bsCanStartSession(rec);
      if (!bsCanStartSession(rec)) startBlocked.textContent = 'Set purpose, appointment, approve a Duty Holder and confirm the appointment first.';
    }

    const followUp = document.getElementById('bs-follow-up-fields');
    if (followUp) followUp.hidden = rec.furtherRequired !== 'yes';

    renderBsCloseSection(rec);
  }

  function renderBsCloseSection(rec) {
    const open = document.getElementById('bs-close-open');
    const done = document.getElementById('bs-close-done');
    const btn = document.getElementById('bs-close-btn');
    const blocked = document.getElementById('bs-close-blocked');
    const spawn = document.getElementById('bs-close-spawn');
    if (rec.workflow === 'closed') {
      if (open) open.hidden = true;
      if (done) {
        done.hidden = false;
        const txt = document.getElementById('bs-close-done-text');
        if (txt) txt.textContent = rec.closeReason || 'Closed.';
      }
      if (spawn) spawn.hidden = !rec.spawnedProcessId;
    } else {
      if (open) open.hidden = rec.workflow === 'setup';
      if (done) done.hidden = true;
      if (btn) btn.disabled = !bsCanClose(rec);
      if (blocked) {
        blocked.hidden = bsCanClose(rec) || rec.workflow === 'setup';
        if (!bsCanClose(rec) && rec.workflow === 'conduct') blocked.textContent = 'Complete the support session and answer whether anything further is required.';
      }
      if (spawn) spawn.hidden = true;
    }
  }

  function initBsActivity(rec) {
    if (rec && rec.activityLog) bsActivityLog = JSON.parse(JSON.stringify(rec.activityLog));
    else bsActivityLog = { notes: [], times: [], files: [] };
    renderBsActivity();
  }

  function renderBsActivity() {
    const feed = document.getElementById('bs-activity-feed-list');
    const notesEl = document.getElementById('bs-count-notes');
    const timeEl = document.getElementById('bs-count-time');
    const noteCount = bsActivityLog.notes.length;
    const totalMin = bsActivityLog.times.reduce(function (s, t) { return s + t.minutes; }, 0);
    const notesLabel = noteCount + (noteCount === 1 ? ' note' : ' notes');
    const timeLabel = (typeof formatAuditMinutes === 'function' ? formatAuditMinutes(totalMin) : totalMin + 'm') + ' logged';
    if (notesEl) notesEl.textContent = notesLabel;
    if (timeEl) timeEl.textContent = timeLabel;
    document.querySelectorAll('#bs-recent-on-support .audit-recent-count-notes, #bs-recent-count-notes').forEach(function (el) { el.textContent = notesLabel; });
    document.querySelectorAll('#bs-recent-on-support .audit-recent-count-time, #bs-recent-count-time').forEach(function (el) { el.textContent = timeLabel; });
    if (!feed) return;
    const items = [];
    bsActivityLog.times.forEach(function (t) { items.push({ ts: t.ts || 0, at: t.at, type: 'time', activity: t.activity, minutes: t.minutes }); });
    bsActivityLog.notes.forEach(function (n) { items.push({ ts: n.ts || 0, at: n.at, type: 'note', text: n.text }); });
    bsActivityLog.files.forEach(function (f) { items.push({ ts: f.ts || 0, at: f.at, type: 'file', name: f.name }); });
    items.sort(function (a, b) { return b.ts - a.ts; });
    if (!items.length) {
      feed.innerHTML = '<div class="audit-feed-empty">No activity logged yet on this business support.</div>';
      return;
    }
    feed.innerHTML = items.map(function (item) {
      let pillClass = 'grey', pillLabel = 'Note', textHtml = escHtml(item.text || '');
      if (item.type === 'time') { pillClass = 'blue'; pillLabel = 'Time'; textHtml = escHtml(item.activity) + ' · <strong>' + escHtml(String(item.minutes)) + 'm</strong>'; }
      else if (item.type === 'file') { pillClass = 'purple'; pillLabel = 'File'; textHtml = '<strong>' + escHtml(item.name) + '</strong>'; }
      return '<div class="audit-feed-item"><div class="audit-feed-meta"><span class="audit-feed-when">' + escHtml(item.at) + '</span></div>' +
        '<div class="audit-feed-body"><span class="pill ' + pillClass + '">' + pillLabel + '</span><span class="audit-feed-text">' + textHtml + '</span></div></div>';
    }).join('');
  }

  function initBizSupportPage() {
    loadBsOverrides();
    const rec = getBizSupportById(activeBizSupportId);
    if (!rec) { show('processes'); return; }

    const crumbsPrem = document.getElementById('bs-crumbs-premises');
    if (crumbsPrem) {
      crumbsPrem.textContent = rec.premises;
      crumbsPrem.onclick = function () {
        if (rec.premises === 'HMP Bristol') show('premisesdetail-bristol');
        else if (rec.premises === 'Temple Quay House') show('premisesdetail');
        else show('premises');
        return false;
      };
    }

    const title = document.getElementById('bs-detail-title');
    const meta = document.getElementById('bs-detail-meta');
    if (title) title.textContent = 'Business support  ·  ' + rec.ref;
    if (meta) {
      const stages = ['', 'Setup', 'Conduct the support', 'Close'];
      const st = bsWorkflowStage(rec);
      const statusPill = rec.workflow === 'closed'
        ? '<span class="pill grey">Closed</span>'
        : '<span class="pill blue">Open</span>';
      meta.innerHTML = '<span class="pill grey">Support</span> Stage ' + st + ' of 3  ·  ' + stages[st] +
        '  ·  ' + statusPill + '  ·  ' + escHtml(rec.openedAt || 'Today');
    }

    const sumPrem = document.getElementById('bs-sum-premises');
    if (sumPrem) sumPrem.textContent = rec.premises || '—';

    renderBsStageRail(rec);
    renderBsPremisesCard(rec);
    renderBsTeam(rec);
    ensureBsDutyHolderSuggestions(getBizSupportById(rec.id) || rec);
    renderBsDutyHolders(getBizSupportById(rec.id) || rec);
    renderBsResponsiblePersons(getBizSupportById(rec.id) || rec);
    renderBsAppointmentFields(getBizSupportById(rec.id) || rec);

    const conductNotes = document.getElementById('bs-conduct-notes');
    if (conductNotes) conductNotes.value = rec.conductNotes || '';

    document.querySelectorAll('input[name="bs-further-required"]').forEach(function (inp) {
      inp.checked = rec.furtherRequired === inp.value;
    });

    const fu = rec.followUp || {};
    const fuDate = document.getElementById('bs-followup-date');
    const fuTime = document.getElementById('bs-followup-time');
    const fuMode = document.getElementById('bs-followup-mode');
    const fuPurpose = document.getElementById('bs-followup-purpose');
    if (fuDate) fuDate.value = fu.date || '';
    if (fuTime) fuTime.value = fu.time || '';
    if (fuMode) fuMode.value = fu.mode || 'call';
    if (fuPurpose) fuPurpose.value = fu.purpose || '';

    renderBsWorkflowSections(getBizSupportById(rec.id) || rec);
    initBsActivity(getBizSupportById(rec.id) || rec);
    setBsActivityBarVisible(rec.workflow !== 'closed');
  }

  function refreshBsPage() { initBizSupportPage(); }

  function saveBsAppointment() {
    const rec = getBizSupportById(activeBizSupportId);
    if (!rec) return;
    persistBsPatch(activeBizSupportId, {
      purpose: document.getElementById('bs-purpose')?.value || '',
      appointment: Object.assign({}, rec.appointment || {}, {
        date: document.getElementById('bs-apt-date')?.value || '',
        time: document.getElementById('bs-apt-time')?.value || '',
        mode: document.getElementById('bs-apt-mode')?.value || 'in_person',
        duration: document.getElementById('bs-apt-duration')?.value || 'half',
        confirmed: !!document.getElementById('bs-apt-confirmed')?.checked
      })
    });
    refreshBsPage();
  }

  function skipBsLetter() {
    const rec = getBizSupportById(activeBizSupportId);
    if (!rec) return;
    persistBsPatch(activeBizSupportId, { appointment: Object.assign({}, rec.appointment || {}, { letterSkipped: true, letterSent: false }) });
    refreshBsPage();
  }

  function sendBsLetter() {
    const rec = getBizSupportById(activeBizSupportId);
    if (!rec) return;
    persistBsPatch(activeBizSupportId, { appointment: Object.assign({}, rec.appointment || {}, { letterSent: true, letterSkipped: false }) });
    refreshBsPage();
  }

  function startBsSession() {
    const rec = getBizSupportById(activeBizSupportId);
    if (!rec || !bsCanStartSession(rec)) {
      alert('Complete setup steps first.');
      return;
    }
    persistBsPatch(activeBizSupportId, { workflow: 'conduct' });
    refreshBsPage();
  }

  function saveBsConductNotes() {
    persistBsPatch(activeBizSupportId, { conductNotes: document.getElementById('bs-conduct-notes')?.value || '' });
  }

  function saveBsFurtherRequired() {
    const picked = document.querySelector('input[name="bs-further-required"]:checked');
    if (!picked) return;
    persistBsPatch(activeBizSupportId, { furtherRequired: picked.value });
    refreshBsPage();
  }

  function saveBsFollowUp() {
    const rec = getBizSupportById(activeBizSupportId);
    if (!rec) return;
    persistBsPatch(activeBizSupportId, {
      followUp: {
        date: document.getElementById('bs-followup-date')?.value || '',
        time: document.getElementById('bs-followup-time')?.value || '',
        mode: document.getElementById('bs-followup-mode')?.value || 'call',
        purpose: document.getElementById('bs-followup-purpose')?.value || ''
      }
    });
    refreshBsPage();
  }

  function closeBsProcess() {
    const rec = getBizSupportById(activeBizSupportId);
    if (!rec || !bsCanClose(rec)) { alert('Complete required steps before closing.'); return; }
    const reason = document.getElementById('bs-close-reason')?.value?.trim();
    if (!reason) { alert('Enter a reason for closing.'); return; }
    const patch = { workflow: 'closed', closeReason: reason, closedAt: new Date().toISOString(), activityLog: bsActivityLog };
    if (rec.furtherRequired === 'yes') patch.spawnedProcessId = 'A-2026-' + String(3400 + Math.floor(Math.random() * 100));
    persistBsPatch(activeBizSupportId, patch);
    refreshBsPage();
  }

  function acceptBsDutyHolder(id) {
    const rec = getBizSupportById(activeBizSupportId);
    if (!rec) return;
    const holders = (rec.dutyHolders || []).map(function (d) {
      return d.id === id ? Object.assign({}, d, { status: 'accepted' }) : d;
    });
    persistBsPatch(activeBizSupportId, { dutyHolders: holders });
    refreshBsPage();
  }

  function removeBsDutyHolder(id) {
    const rec = getBizSupportById(activeBizSupportId);
    if (!rec) return;
    persistBsPatch(activeBizSupportId, { dutyHolders: (rec.dutyHolders || []).filter(function (d) { return d.id !== id; }) });
    refreshBsPage();
  }

  function addBsDutyHolder() {
    if (typeof setupLookupTarget !== 'undefined') setupLookupTarget = 'bizsupport';
    if (typeof openSetupLookupModal === 'function') openSetupLookupModal('dutyHolder');
  }

  function addBsResponsiblePerson() {
    if (typeof setupLookupTarget !== 'undefined') setupLookupTarget = 'bizsupport';
    if (typeof openSetupLookupModal === 'function') openSetupLookupModal('responsiblePerson');
  }

  function acceptBsResponsiblePerson(id) {
    const rec = getBizSupportById(activeBizSupportId);
    if (!rec) return;
    const rps = (rec.responsiblePersons || []).map(function (r) {
      return r.id === id ? Object.assign({}, r, { status: 'accepted' }) : r;
    });
    persistBsPatch(activeBizSupportId, { responsiblePersons: rps });
    refreshBsPage();
  }

  function removeBsResponsiblePerson(id) {
    const rec = getBizSupportById(activeBizSupportId);
    if (!rec) return;
    persistBsPatch(activeBizSupportId, { responsiblePersons: (rec.responsiblePersons || []).filter(function (r) { return r.id !== id; }) });
    refreshBsPage();
  }

  function addBsInspector() {
    if (typeof setupLookupTarget !== 'undefined') setupLookupTarget = 'bizsupport';
    if (typeof openSetupLookupModal === 'function') openSetupLookupModal('inspector');
  }

  function removeBsInspector(id) {
    const rec = getBizSupportById(activeBizSupportId);
    if (!rec) return;
    persistBsPatch(activeBizSupportId, { inspectors: (rec.inspectors || []).filter(function (i) { return i.id !== id; }) });
    refreshBsPage();
  }

  function openBizSupport(id) { show('bizsupport/' + id); }

  function startBizSupportFromPremises(premisesName) {
    loadBsOverrides();
    const existing = getAllBsRecords().find(function (r) {
      return r.premises === premisesName && r.workflow === 'setup';
    });
    if (existing) { openBizSupport(existing.id); return; }
    const id = 'bs-new-' + Date.now();
    const rec = defaultBsRecord(id, premisesName);
    bsOverrides[id] = rec;
    saveBsOverrides();
    openBizSupport(id);
  }

  function setBsActivityBarVisible(visible) {
    document.body.classList.toggle('bs-activity-bar', visible);
    if (!visible) document.body.classList.remove('bs-float-panel-open');
  }

  function openBsFloatPanel(mode) {
    const panel = document.getElementById('bs-float-panel');
    if (!panel) return;
    setBsActivityBarVisible(true);
    setBsLogType(mode || bsLogType || 'time');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('bs-float-panel-open');
  }

  function closeBsFloatPanel() {
    const panel = document.getElementById('bs-float-panel');
    if (panel) { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('bs-float-panel-open');
  }

  function setBsLogType(type) {
    bsLogType = type;
    ['time', 'note', 'file'].forEach(function (t) {
      const el = document.getElementById('bs-log-fields-' + t);
      if (el) el.hidden = t !== type;
    });
    document.querySelectorAll('#bs-log-type-row .chip').forEach(function (chip) {
      chip.classList.toggle('active', chip.dataset.bsLogType === type);
    });
  }

  function submitBsLog() {
    const stamp = typeof cpinLogTimestamp === 'function' ? cpinLogTimestamp() : { at: 'Today', ts: Date.now() };
    if (bsLogType === 'note') {
      const text = document.getElementById('bs-note-text')?.value?.trim();
      if (!text) { alert('Enter a note.'); return; }
      bsActivityLog.notes.unshift({ id: 'bn' + stamp.ts, text: text, at: stamp.at, ts: stamp.ts });
      document.getElementById('bs-note-text').value = '';
    } else if (bsLogType === 'time') {
      bsActivityLog.times.unshift({
        id: 'bt' + stamp.ts,
        activity: document.getElementById('bs-time-activity')?.value || 'Meeting',
        minutes: parseInt(document.getElementById('bs-time-duration')?.value || '30', 10),
        at: stamp.at, ts: stamp.ts
      });
    } else if (bsLogType === 'file') {
      const desc = document.getElementById('bs-file-desc')?.value?.trim() || 'File';
      const input = document.getElementById('bs-file-input');
      const name = input?.files?.[0]?.name || 'attachment.pdf';
      bsActivityLog.files.unshift({ id: 'bf' + stamp.ts, name: name, description: desc, at: stamp.at, ts: stamp.ts });
      if (input) input.value = '';
      document.getElementById('bs-file-desc').value = '';
    }
    persistBsPatch(activeBizSupportId, { activityLog: bsActivityLog });
    renderBsActivity();
    closeBsFloatPanel();
  }

  window.initBizSupportPage = initBizSupportPage;
  window.openBizSupport = openBizSupport;
  window.startBizSupportFromPremises = startBizSupportFromPremises;
  window.saveBsAppointment = saveBsAppointment;
  window.skipBsLetter = skipBsLetter;
  window.sendBsLetter = sendBsLetter;
  window.startBsSession = startBsSession;
  window.saveBsConductNotes = saveBsConductNotes;
  window.saveBsFurtherRequired = saveBsFurtherRequired;
  window.saveBsFollowUp = saveBsFollowUp;
  window.closeBsProcess = closeBsProcess;
  window.acceptBsDutyHolder = acceptBsDutyHolder;
  window.removeBsDutyHolder = removeBsDutyHolder;
  window.addBsDutyHolder = addBsDutyHolder;
  window.addBsResponsiblePerson = addBsResponsiblePerson;
  window.acceptBsResponsiblePerson = acceptBsResponsiblePerson;
  window.removeBsResponsiblePerson = removeBsResponsiblePerson;
  window.addBsInspector = addBsInspector;
  window.removeBsInspector = removeBsInspector;
  window.setBsActivityBarVisible = setBsActivityBarVisible;
  window.openBsFloatPanel = openBsFloatPanel;
  window.closeBsFloatPanel = closeBsFloatPanel;
  window.setBsLogType = setBsLogType;
  window.submitBsLog = submitBsLog;
  window.getBizSupportById = getBizSupportById;
  window.persistBsPatch = persistBsPatch;
  window.activeBizSupportId = function () { return activeBizSupportId; };
  window.setActiveBizSupportId = function (id) { activeBizSupportId = id; };
})();
