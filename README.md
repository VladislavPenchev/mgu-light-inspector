# Light Inspector — read-only first version

Manual identification of three BMW iDrive 7 ECU candidates: BDC (0x40), left headlight (0x43), right headlight (0x44). Addresses are candidates, not proof of the installed unit type. This version does NOT unlock welcome animations.

## What it reads

Version 0.1.1 uses five fixed identification DIDs per candidate: F150 (SGBD family), F101 (current SVK, kept raw), F18A (supplier), F18B (manufacturing data), F18C (serial number). Each is explicitly described as a UDS 22 read in Default mode by the matching BDC_G05 / FLM02_L / FLM02_R PRG documentation. No VIN is requested. Serial and raw identification data remain in the local private report.

The first F150 reply must exactly match BDC_G05 / 0F2680 at 40, FLM02_L / 0F26C0 at 43, or FLM02_R / 0F26D0 at 44. A missing/refused/mismatched family immediately skips that ECU; no speculative alternate DIDs or sessions. These families were mapped from an owner-authorized identification capture; no actual report or serial numbers are published here. A successful family match does not establish exact hardware/software compatibility.

Source definitions: [BDC_G05](https://github.com/emdzej/ediabasx-docs-sgbd/blob/main/docs/sgbd/BDC_G05.md), [FLM02_L](https://github.com/emdzej/ediabasx-docs-sgbd/blob/main/docs/sgbd/FLM02_L.md), [FLM02_R](https://github.com/emdzej/ediabasx-docs-sgbd/blob/main/docs/sgbd/FLM02_R.md). These are extracted diagnostic references, not an OEM-approved coding procedure. Their welcome-mode labels do not prove that this car supports selecting or customizing them.

## Write barrier

No diagnostic request occurs at startup. The user must press **Read identification**, with fresh stationary speed data (<0.5 km/h, received within 5 seconds). Speed is re-read every 2 seconds. Stop, leaving the page, movement, missing speed data or shutdown cancels queued requests. The last in-flight read can still finish.

Every outgoing TASU call is independently checked at the transport boundary. Only SID 0x22, the three physical ECU addresses, and exactly one of the fixed identification DIDs is accepted. No functional broadcasts, sessions, security access, lamp routines, actuator control, resets, fault clearing, downloads, brightness/current changes or coding writes. No arbitrary command input. Reads are sequential with a 250 ms minimum gap, at most 15 requested identifiers per scan; two missing replies skip that ECU. No retry into another diagnostic session when access is refused.

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

MGU Store source catalog: `mgu-repo.json`. Without the donor SDK, the preview is **not an installable package**. Version 0.1.0 completed an owner-authorized read-only identification scan on the car. Version 0.1.1 adds documented reads and family matching; these new fields still need an on-car manual capture. No coding, flash or lamp actuation was performed.

## Risk and scope

Reading ECU identification is intended not to change lamp configuration or energize outputs. It is much less invasive than coding or actuator testing, but no untested vehicle software can promise zero risk; transport faults, battery consumption and interactions with other diagnostic software remain possible. We do not test the laser emitters or LED channels. Future actuator/parameter writes could affect normal lighting or damage hardware if incorrect; a metadata report is not protection against that.

References:
- MGU app kit / TASU transport: https://github.com/cauliflowermossgrape/idrive7-apps (MIT; notices in kit/LICENSE.upstream).
- Standard identification DID names: https://udsoncan.readthedocs.io/en/latest/udsoncan/helper_classes.html
- Coding backup limits and Expert Mode warning: https://bimmercode.app/faq/ and https://bimmercode.app/manual/

Version 0.1.1. Written using OpenAI Codex; 10 simulated tests, no human review. Hardware/software compatibility remains undetermined.
