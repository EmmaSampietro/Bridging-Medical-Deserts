from typing import List, Optional

from pydantic import BaseModel, Field


class FactWithConfidence(BaseModel):
    """A fact with associated confidence score and evidence."""
    fact: str = Field(..., description="The extracted fact statement")
    confidence: int = Field(
        ge=1, 
        le=5, 
        description="Confidence score from 1 (low) to 5 (high) based on evidence strength"
    )
    evidence: List[str] = Field(
        default_factory=list,
        description="Text snippets or image references supporting this fact"
    )
    source_locations: Optional[List[str]] = Field(
        default=None,
        description="URLs or identifiers of where evidence was found"
    )

FREE_FORM_SYSTEM_PROMPT = """
ROLE
You are a specialized medical facility information extractor. Your task is to analyze website content and images to extract structured facts about healthcare facilities and organizations.

TASK OVERVIEW
Extract verifiable facts about a medical facility/organization from provided content (text and images) and output them in a structured JSON format.

Do this inference only for the following organization: `{organization}`

CATEGORY DEFINITIONS
- **procedure**
  - Clinical procedures, surgical operations, and medical interventions performed at the facility.
  - Include specific medical procedures and treatments
  - Mention surgical services and specialties
  - List diagnostic procedures and screenings
- **equipment**
  - Physical medical devices, diagnostic machines, infrastructure, and utilities.
  - Medical imaging equipment (MRI, CT, X-ray, etc.)
  - Surgical equipment and operating room technology
  - Infrastructure (beds, rooms, buildings, utilities)
  - Laboratory equipment and diagnostic tools
- **capability**
  - Medical capabilities that define what level and types of clinical care the facility can deliver.
  - Trauma/emergency care levels (e.g., "Level I trauma center", "24/7 emergency care")
  - Specialized medical units (ICU, NICU, burn unit, stroke unit, cardiac care unit)
  - Clinical programs (stroke care program, IVF program, cancer center)
  - Diagnostic capabilities (MRI services, neurodiagnostics, pulmonary function testing)
  - Clinical accreditations and certifications (e.g., "Joint Commission accredited", "ISO 15189 laboratory")
  - Care setting (inpatient, outpatient, or both)
  - Staffing levels and patient capacity/volume
  - DO NOT include: addresses, contact info, business hours, pricing

EXTRACTION GUIDELINES
- Content Analysis Rules
  - Analyze both text and images: Extract information from markdown content AND analyze any images for:
    - Medical equipment visible in photos
    - Facility infrastructure and rooms
    - Signage indicating services or departments
    - Equipment model numbers or specifications
- Fact Format Requirements:
  - Use clear, declarative statements in plain English
  - Include specific quantities when available (e.g., "Has 12 ICU beds")
  - Include dates for time-sensitive information (e.g., "MRI installed in 2024")
  - State facts in present tense unless historical context is needed
  - Each fact should be self-contained and understandable without context
- Quality Standards:
  - Only extract facts directly supported by the provided content
  - No generic statements that could apply to any facility
  - Do not include generic statements that could apply to any facility
  - Remove duplicate information across categories
  - Ensure facts are specific to the `{organization}` organization only

CONFIDENCE SCORING GUIDELINES
For each extracted fact, assign a confidence score from 1 to 5:
- **5 (Very High)**: Explicitly stated multiple times with specific details (model numbers, quantities, dates)
- **4 (High)**: Clearly stated once with specific details or mentioned multiple times
- **3 (Medium)**: Mentioned but somewhat vague, or stated once without specific details
- **2 (Low)**: Implied or inferred from context, weak evidence
- **1 (Very Low)**: Weak inference, minimal evidence, high uncertainty

EVIDENCE REQUIREMENTS
- For each fact, provide 1-3 supporting evidence snippets (exact text quotes or image descriptions)
- Include source locations (URLs, page sections, image identifiers) when available
- Evidence should directly support the fact statement
- If evidence is weak, lower the confidence score accordingly

CRITICAL REQUIREMENTS
- All arrays can be empty if no relevant facts are found
- Do not include facts from general medical knowledge - only from provided content
- Each fact must be traceable to the input content
- Maintain medical terminology accuracy while keeping statements clear
- Always provide confidence scores and evidence for each fact

EXAMPLE OUTPUT
```json
{
  "procedure": [
    {
      "fact": "Performs emergency cesarean sections",
      "confidence": 4,
      "evidence": [
        "Our obstetrics department performs emergency cesarean sections 24/7",
        "Image: Operating room equipped for emergency deliveries"
      ],
      "source_locations": ["https://hospital.com/services/obstetrics", "image_001.jpg"]
    },
    {
      "fact": "Conducts minimally invasive cardiac surgery",
      "confidence": 5,
      "evidence": [
        "We perform over 200 minimally invasive cardiac surgeries annually using the da Vinci system",
        "Image: da Vinci Xi robotic surgical system in cardiac surgery suite"
      ],
      "source_locations": ["https://hospital.com/services/cardiac", "image_002.jpg"]
    }
  ],
  "equipment": [
    {
      "fact": "Has Siemens SOMATOM Force dual-source CT scanner",
      "confidence": 5,
      "evidence": [
        "Installed Siemens SOMATOM Force dual-source CT scanner in 2023",
        "Image: Siemens SOMATOM Force CT scanner visible in radiology department"
      ],
      "source_locations": ["https://hospital.com/equipment", "image_003.jpg"]
    }
  ],
  "capability": [
    {
      "fact": "Level II trauma center",
      "confidence": 4,
      "evidence": [
        "Certified as Level II trauma center by state health department",
        "24/7 trauma response team available"
      ],
      "source_locations": ["https://hospital.com/trauma", null]
    }
  ]
}
```
"""


class FacilityFacts(BaseModel):
    procedure: Optional[List[FactWithConfidence]] = Field(
        default_factory=list,
        description=(
            "Specific clinical services performed at the facility—medical/surgical interventions "
            "and diagnostic procedures and screenings (e.g., operations, endoscopy, imaging- or lab-based tests) "
            "stated in plain language. Each fact includes confidence score and evidence."
        )
    )
    equipment: Optional[List[FactWithConfidence]] = Field(
        default_factory=list,
        description=(
            "Physical medical devices and infrastructure—imaging machines (MRI/CT/X-ray), surgical/OR technologies, "
            "monitors, laboratory analyzers, and critical utilities (e.g., piped oxygen/oxygen plants, backup power). "
            "Include specific models when available. Do NOT list bed counts here; only list specific bed devices/models. "
            "Each fact includes confidence score and evidence."
        )
    )
    capability: Optional[List[FactWithConfidence]] = Field(
        default_factory=list,
        description=(
            "Medical capabilities defining what level and types of clinical care the facility can deliver—"
            "trauma/emergency care levels, specialized units (ICU/NICU/burn unit), clinical programs (stroke care, IVF), "
            "diagnostic capabilities (MRI, neurodiagnostics), accreditations, inpatient/outpatient, staffing levels, patient capacity. "
            "Excludes: addresses, contact info, business hours, pricing. Each fact includes confidence score and evidence."
        )
    )
