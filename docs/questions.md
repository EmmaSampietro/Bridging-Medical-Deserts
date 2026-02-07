# VF planner question backlog

Planner questions to test against the pipeline (e.g. “Where are C-sections unavailable?”, “Which hospitals claim ICUs but lack oxygen?”). Map each to pipeline evaluations and acceptance criteria.

## Default acceptance questions used by `scripts/eval_suite.py`
1. `q_c_section_absent`
   - Prompt: "Where are C-sections unavailable?"
   - Evaluation type: `capability_status_count`
   - Filters: `capability=c_section`, `statuses=[absent]`
2. `q_icu_without_oxygen`
   - Prompt: "Which hospitals claim ICUs but lack oxygen?"
   - Evaluation type: `missing_prerequisite`
   - Filters: `capability=icu`, `prerequisite=oxygen_supply`

## Optional JSON question spec format
Place files under `inputs/questions/*.json`. Supported payloads:
- a single object
- an array of objects
- an object with `questions: [...]`

### Supported question types
1. `capability_status_count`
   - Required:
     - `id`
     - `type`
     - `capability`
   - Optional:
     - `prompt`
     - `statuses` (defaults to `["present"]`)
     - `expect_min`, `expect_max`
     - `required` (boolean; if true and failed, overall eval fails with `--fail-on-check`)
2. `missing_prerequisite`
   - Required:
     - `id`
     - `type`
     - `capability`
     - `prerequisite` (or `required_capability`)
   - Optional:
     - `prompt`
     - `capability_statuses` (defaults to `["present", "uncertain"]`)
     - `lacking_statuses` (defaults to `["absent", "missing"]`)
     - `expect_min`, `expect_max`
     - `required`

## Example
```json
{
  "questions": [
    {
      "id": "q_c_section_absent",
      "type": "capability_status_count",
      "prompt": "Where are C-sections unavailable?",
      "capability": "c_section",
      "statuses": ["absent"],
      "expect_min": 1
    },
    {
      "id": "q_icu_without_oxygen",
      "type": "missing_prerequisite",
      "prompt": "Which hospitals claim ICUs but lack oxygen?",
      "capability": "icu",
      "prerequisite": "oxygen_supply",
      "required": true
    }
  ]
}
```
