# Light Inspector — read-only first version

Manual identification of three BMW iDrive 7 ECU candidates: BDC (0x40), left headlight (0x43), right headlight (0x44). Addresses are candidates, not proof of the installed unit type. This version does NOT unlock welcome animations.

## What it reads

Only eight fixed identification DIDs per candidate: F150 (BMW SGBD), F180/F181/F182 (boot/application/application-data **identification**), F187/F188/F189 (part and software identifiers), F191 (hardware number). An ECU can refuse or not implement them. No VIN is deliberately requested. Raw replies and printable hints are saved without guessing their BMW-specific format. Welcome compatibility always remains **not determined** until the actual identifiers are reviewed.

## Write barrier

No diagnostic request occurs at startup. The user must press **Read identification**, with fresh stationary speed data (<0.5 km/h, received within 5 seconds). Speed is re-read every 2 seconds. Stop, leaving the page, movement, missing speed data or shutdown cancels queued requests. The last in-flight read can still finish.

Every outgoing TASU call is independently checked at the transport boundary. Only SID 0x22, the three physical ECU addresses, and exactly one of the fixed identification DIDs is accepted. No functional broadcasts, sessions, security access, lamp routines, actuator control, resets, fault clearing, downloads, brightness/current changes or coding writes. No arbitrary command input. Reads are sequential with a 250 ms minimum gap, at most 24 requested identifiers per scan; two missing replies skip that ECU. No retry into another diagnostic session when access is refused.

This guard is a software safeguard within this app, not OS-level isolation against a different privileged app. Do not run other coding or lamp-test applications during a scan.

## Archive — NOT a recoverable backup

Each scan creates a new local `data/light-reports/<timestamp>-<random>.json` and SHA-256 sidecar. It saves progress after each answer, explicitly marks incomplete/cancelled captures and keeps the first completed identification capture unchanged. Previous reports are never overwritten by later scans. Files are private to the app user (0600; folder 0700). A 16 MiB archive limit refuses new scans rather than deleting existing reports. No upload/network server/cloud sync is included.

**These reports contain identification data only. They are NOT NCD/CAFD coding backups or ECU flash images, cannot restore a damaged module, and do not justify attempting coding. There is deliberately no Restore or Activate button.** Before a future coding-capable version, actual module-specific coding data must be read and its recovery process independently established with a suitable BMW coding tool. A checksum detects modification/corruption of the report; it does not prove ECU recoverability or authenticity.

To verify an exported report:

```
node tools/verify-report.js path/to/report.json
```

Copy both the JSON and `.sha256` from the app data directory to your computer after a real scan. No real car data is bundled in this project.

## Build

```
npm test
npm run build:preview
# Extract BMW oap-sdk from your own donor app, into oap-sdk/ (never commit it).
node kit/tools/extract_sdk.js /path/to/donor/app.js oap-sdk
npm run build
```

MGU Store source catalog: `mgu-repo.json`. Without the donor SDK, the preview is **not an installable package**. This version is prepared offline and has NOT been run on a car. No car connection, read, coding, flash or lamp test was performed during development.

## Risk and scope

Reading ECU identification is intended not to change lamp configuration or energize outputs. It is much less invasive than coding or actuator testing, but no untested vehicle software can promise zero risk; transport faults, battery consumption and interactions with other diagnostic software remain possible. We do not test the laser emitters or LED channels. Future actuator/parameter writes could affect normal lighting or damage hardware if incorrect; a metadata report is not protection against that.

References:
- MGU app kit / TASU transport: https://github.com/cauliflowermossgrape/idrive7-apps (MIT; notices in kit/LICENSE.upstream).
- Standard identification DID names: https://udsoncan.readthedocs.io/en/latest/udsoncan/helper_classes.html
- Coding backup limits and Expert Mode warning: https://bimmercode.app/faq/ and https://bimmercode.app/manual/

Version 0.1.0. Written using OpenAI Codex; local simulated tests only, no human review or on-car validation.
