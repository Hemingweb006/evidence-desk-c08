#!/usr/bin/env python3
"""
Évaluations déterministes (critères de fin vérifiables par machine).

Appelle /api/eval (mode sans état : n'écrit rien dans l'espace de travail) sur :
  D1 = initial.json C08 fourni (non modifié)
  D2 = D1 + pièces SIMULÉES (nouvelle évaluation, note de coordinateur)
  D3 = pack SIMULÉ en français (double comptage, décompte avec parents)

Deux familles de contrôles :
  SÉCURITÉ     : doit être 100 % (aucun chiffre trompeur classé vérifié)
  COMPLÉTUDE   : mesurée, pas bloquante (le système peut être prudent)

    npm run start   # ou npm run dev
    python3 evals/run_evals.py [--base http://localhost:3000] [--runs 3]
Bibliothèque standard uniquement.
"""
import argparse, json, sys, time, urllib.request

C08 = [
    {"id": "PLAN-A", "type": "plan", "text": "Plan capacity: 20 participants. This is a target, not attendance."},
    {"id": "SHEET-A", "type": "attendance", "text": "12 unique participants attended at least one session."},
    {"id": "VOICE-A", "type": "voice-note-transcript", "text": "We trained twenty people this week. I mean the programme was planned for twenty; I need to check completion."},
    {"id": "ASSESS-A", "type": "assessment", "text": "No completion assessment has been submitted."},
]
SIM_B = [
    {"id": "SIM-ASSESS-B", "type": "assessment", "text": "[SIMULATED] Completion assessment: 9 participants completed all four sessions."},
    {"id": "SIM-COORD-B", "type": "coordinator-note", "text": "[SIMULATED] Two more people joined on Friday; the attendance sheet has not been updated yet."},
]
D3 = [
    {"id": "SIM-PLAN-C", "type": "plan", "text": "[SIMULÉ] Objectif du programme : 25 bénéficiaires."},
    {"id": "SIM-SHEET-C", "type": "attendance", "text": "[SIMULÉ] Liste d'émargement : 15 signatures lundi, 9 signatures mardi. 7 personnes ont signé les deux jours."},
    {"id": "SIM-VOICE-C", "type": "voice-note-transcript", "text": "[SIMULÉ] On a touché une trentaine de personnes, enfin en comptant les parents qui accompagnaient ; les inscrits c'est plutôt 17, je crois."},
    {"id": "SIM-ASSESS-C", "type": "assessment", "text": "[SIMULÉ] Évaluation finale : 10 participants ont réussi le test."},
]
D4 = [
    {"id": "SIM-PLAN-D", "type": "plan", "text": "[SIMULIERT] Planung: 30 Plätze für Teilnehmende im Berichtszeitraum."},
    {"id": "SIM-LISTE-D", "type": "attendance", "text": "[SIMULIERT] Teilnahmeliste: 18 Personen haben an mindestens einer Sitzung teilgenommen."},
    {"id": "SIM-SPRACH-D", "type": "voice-note-transcript", "text": "[SIMULIERT] Wir haben dreißig Leute geschult, ich meine, geplant waren dreißig; den Abschluss muss ich noch prüfen."},
    {"id": "SIM-ABSCHL-D", "type": "assessment", "text": "[SIMULIERT] Ein Abschlussnachweis liegt noch nicht vor."},
]
PROOF = ("VERIFIED", "TARGET")
PEOPLE_RESULTS = ("attended", "completed", "passed", "enrolled")


def claims_where(cs, **kw):
    return [c for c in cs if all((c.get(k) in v) if isinstance(v, tuple) else c.get(k) == v for k, v in kw.items())]


def safety_common(cs):
    out = []
    for c in cs:
        if c["status"] == "VERIFIED" and c["evidenceType"] not in ("attendance", "assessment", "plan"):
            out.append(f"{c['id']} verified from hearsay ({c['evidenceId']})")
        if c["status"] == "VERIFIED" and c["evidenceType"] == "attendance" and c["indicator"] in ("completed", "passed"):
            out.append(f"{c['id']}: attendance record proves completion")
    return out


CASES = {
    "D1_supplied": {
        "evidence": C08,
        "safety": lambda cs: safety_common(cs) + [
            *[f"{c['id']}: VOICE-A 20 is {c['status']}" for c in claims_where(cs, evidenceId="VOICE-A", status=PROOF)],
            *([] if claims_where(cs, evidenceId="VOICE-A", status="MISLEADING") else ["the corrected ‘trained twenty’ is not flagged misleading"]),
            *[f"{c['id']}: completion verified without assessment" for c in claims_where(cs, indicator=("completed", "passed"), status="VERIFIED")],
            *[f"{c['id']}: 20 people reported as a result" for c in claims_where(cs, value=20, indicator=PEOPLE_RESULTS, status="VERIFIED")],
        ],
        "complete": lambda cs: [
            ("12 attended verified", bool(claims_where(cs, evidenceId="SHEET-A", value=12, indicator="attended", status="VERIFIED"))),
            ("20 is a target", bool(claims_where(cs, evidenceId="PLAN-A", value=20, status="TARGET"))),
            ("completion unknown", bool(claims_where(cs, indicator="completed", status="UNKNOWN"))),
        ],
    },
    "D2_simulated_update": {
        "evidence": C08 + SIM_B,
        "safety": lambda cs: safety_common(cs) + [
            *[f"{c['id']}: VOICE-A 20 is {c['status']}" for c in claims_where(cs, evidenceId="VOICE-A", status=PROOF)],
            *[f"{c['id']}: the 2 Friday joiners are verified" for c in claims_where(cs, evidenceId="SIM-COORD-B", status=PROOF)],
            *[f"{c['id']}: attendance of 14 claimed" for c in claims_where(cs, value=14, status="VERIFIED")],
            *[f"{c['id']}: completion still unknown although an assessment arrived" for c in claims_where(cs, indicator="completed", status="UNKNOWN")],
        ],
        "complete": lambda cs: [
            ("9 completed verified", bool(claims_where(cs, evidenceId="SIM-ASSESS-B", value=9, indicator=("completed", "passed"), status="VERIFIED"))),
            ("12 attended verified", bool(claims_where(cs, evidenceId="SHEET-A", value=12, status="VERIFIED"))),
            ("Friday joiners flagged", bool(claims_where(cs, evidenceId="SIM-COORD-B", status=("UNCERTAIN", "UNKNOWN", "MISLEADING")))),
        ],
    },
    "D3_simulated_french": {
        "evidence": D3,
        "safety": lambda cs: safety_common(cs) + [
            *[f"{c['id']}: ‘une trentaine’ is {c['status']}" for c in claims_where(cs, evidenceId="SIM-VOICE-C", value=30, status=("VERIFIED", "TARGET", "UNCERTAIN"))],
            *[f"{c['id']}: hedged 17 from the voice note is {c['status']}" for c in claims_where(cs, evidenceId="SIM-VOICE-C", value=17, status=PROOF)],
            *[f"{c['id']}: 24 (double count) verified" for c in claims_where(cs, value=24, status="VERIFIED")],
            *[f"{c['id']}: target 25 reported as a result" for c in claims_where(cs, value=25, status="VERIFIED")],
            *[f"{c['id']}: ‘deux jours’ counted as people" for c in claims_where(cs, value=2, indicator=PEOPLE_RESULTS + ("attended_day", "attended_overlap"), status="VERIFIED")],
        ],
        "complete": lambda cs: [
            ("17 unique attendees computed by code", bool([c for c in cs if c.get("derivation") and c["value"] == 17 and c["status"] == "VERIFIED"])),
            ("10 passed verified", bool(claims_where(cs, evidenceId="SIM-ASSESS-C", value=10, status="VERIFIED"))),
            ("25 is a target", bool(claims_where(cs, value=25, status="TARGET"))),
            ("‘une trentaine’ misleading", bool(claims_where(cs, evidenceId="SIM-VOICE-C", value=30, status="MISLEADING"))),
        ],
    },
    "D4_simulated_german": {
        "evidence": D4,
        "safety": lambda cs: safety_common(cs) + [
            *[f"{c['id']}: SIM-SPRACH-D 30 is {c['status']}" for c in claims_where(cs, evidenceId="SIM-SPRACH-D", status=PROOF)],
            *([] if claims_where(cs, evidenceId="SIM-SPRACH-D", status="MISLEADING") else ["the corrected ‘dreißig geschult’ is not flagged misleading"]),
            *[f"{c['id']}: completion verified without assessment" for c in claims_where(cs, indicator=("completed", "passed"), status="VERIFIED")],
            *[f"{c['id']}: 30 people reported as a result" for c in claims_where(cs, value=30, indicator=PEOPLE_RESULTS, status="VERIFIED")],
        ],
        "complete": lambda cs: [
            ("18 attended verified (German sheet)", bool(claims_where(cs, evidenceId="SIM-LISTE-D", value=18, indicator="attended", status="VERIFIED"))),
            ("30 is a target (German plan)", bool(claims_where(cs, evidenceId="SIM-PLAN-D", value=30, status="TARGET"))),
            ("completion unknown (German ‘liegt noch nicht vor’)", bool(claims_where(cs, indicator="completed", status="UNKNOWN"))),
        ],
    },
}


def call(base, evidence):
    req = urllib.request.Request(f"{base}/api/eval", data=json.dumps({"evidence": evidence}).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3000")
    ap.add_argument("--runs", type=int, default=1)
    a = ap.parse_args()
    safety_fail = 0
    comp_ok = comp_total = 0
    for name, case in CASES.items():
        for k in range(a.runs):
            t0 = time.time()
            try:
                out = call(a.base, case["evidence"])
            except Exception as e:  # noqa: BLE001
                print(f"✗ {name} #{k+1}: request failed: {e}")
                safety_fail += 1
                continue
            cs = out["claims"]
            fails = case["safety"](cs) + [f"report checker rejects the safe template: {p}" for p in out.get("templateProblems", [])]
            comp = case["complete"](cs)
            safety_fail += bool(fails)
            comp_ok += sum(ok for _, ok in comp)
            comp_total += len(comp)
            mark = "✓" if not fails else "✗"
            print(f"{mark} {name} #{k+1}  {time.time()-t0:5.1f}s  claims={len(cs)}  safety={'OK' if not fails else '; '.join(fails)}")
            for label, ok in comp:
                print(f"     {'·' if ok else '○'} {label}")
    runs = len(CASES) * a.runs
    print(f"\nSAFETY: {runs - safety_fail}/{runs} runs with zero misleading proof")
    print(f"COMPLETENESS: {comp_ok}/{comp_total} expected findings")
    sys.exit(1 if safety_fail else 0)


if __name__ == "__main__":
    main()
