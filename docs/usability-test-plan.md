# Mechanic & Parts-Counter Usability Test Plan

**Status: protocol ready — sessions have not been run.** This is a code deliverable, not evidence of user validation. Recruit and run the sessions before treating the findings as product evidence.

## Research question

Can a mechanic, service writer, or parts-counter user get from a VIN or a part number to a trustworthy fitment answer on a phone without help?

## Participants

Recruit 6 participants (minimum 5, maximum 8):

- 3 working mechanics or service technicians
- 2 parts-counter or parts-store staff
- 1 motivated owner who does their own maintenance

Screen for: has looked up a part by VIN or OEM number in the last 30 days; uses a phone in the shop at least occasionally. Include at least two participants who use a paper/desktop workflow today. Do not recruit automotive software vendors or AutoParts contributors.

## Session setup

- 30–35 minutes, remote or in person.
- Phone-sized viewport plus a desktop viewport if the participant uses both.
- Read the consent script; record only with explicit permission.
- Ask participants to think aloud. Do not teach the interface or explain the catalog disclaimer before the tasks.
- Use a neutral facilitator and a separate note-taker if possible.

## Tasks

1. **Decode a VIN.** Give the participant a 2020 Civic VIN on a card. Observe whether they find the decoder, enter the VIN, and understand the result.
2. **Use the VIN result.** Ask: “What would you do next to find a front brake pad?” Observe whether they see the catalog handoff and the recall panel.
3. **Browse by assembly.** From the 2020 Civic model page, find the brakes assembly and then the front brake pad. Note whether the assembly grid or search is used.
4. **Check fitment.** Ask them to decide whether the part fits a Civic EX with the 1.5L turbo. Observe whether they find the engine/trim controls, understand the confidence badge, and read the dealer-verification language.
5. **Start with a number.** Give them `45022-TBA-A00` and ask them to find the part without using the VIN. Observe the global search and whether the result preserves vehicle context.
6. **Carry the result.** Ask them to copy the OEM number, share or save the vehicle, and print the parts sheet. Note which action they expect to work on a shop phone.
7. **Mobile/offline expectation.** Ask what they expect when the shop Wi-Fi drops. Do not prompt them toward the PWA or My Garage features.

## Metrics

- Task completion without assistance
- Time to first correct part
- Wrong turns / backtracking
- Whether the participant noticed and understood the “representative catalog” and “verify with dealer” language
- Whether the participant trusted the fitment signal, and why
- Whether they expected a price, stock, or retailer action that does not exist
- System Usability Scale (SUS) after the tasks
- Verbatim quotes about “Browse parts,” fitment confidence, and mobile use

## Discussion prompts

- “What did you expect after decoding the VIN?”
- “What would make you trust this fitment result?”
- “When would you start with a part number instead of a vehicle?”
- “What would you need to carry this into a customer conversation?”
- “What is missing before you would use this at the counter?”

## Analysis and follow-up

- Report task-by-task completion, not just an average SUS score.
- Separate missing data from missing UI.
- Flag any case where a participant would have ordered the wrong part.
- Feed terminology and data-model changes into the next catalog slice.
- Re-run the same protocol after the licensed data source and additional vehicles are added.

## Known limitations

The current catalog covers one representative 2020 Civic slice. Recalls come from NHTSA by year/make/model, not VIN-specific open-recall status. My Garage is local to one browser. The VIN camera scan depends on the browser’s BarcodeDetector support and a Code 39 label. These limitations should be stated to participants only after they have attempted the tasks.
