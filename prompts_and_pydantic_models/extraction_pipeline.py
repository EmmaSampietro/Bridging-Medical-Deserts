"""
Example integration module showing how to use the confidence scoring system.

This module demonstrates how to integrate the confidence scorer into an extraction pipeline.
"""

from typing import List, Optional

from .confidence_scorer import ConfidenceScorer
from .free_form import FacilityFacts, FREE_FORM_SYSTEM_PROMPT


def extract_facility_facts_with_confidence(
    organization: str,
    source_content: str,
    source_images: Optional[List[str]] = None,
    llm_client=None  # Placeholder for actual LLM client (OpenAI, Anthropic, etc.)
) -> FacilityFacts:
    """
    Extract facility facts with confidence scoring.
    
    This is an example function showing how to integrate confidence scoring
    into an extraction pipeline. Replace the llm_client parameter with your
    actual LLM API client.
    
    Args:
        organization: Name of the organization/facility
        source_content: Text content from website/documents
        source_images: Optional list of image descriptions or image data
        llm_client: LLM API client (OpenAI, Anthropic, etc.)
        
    Returns:
        FacilityFacts with confidence scores and evidence
        
    Example usage:
        ```python
        from prompts_and_pydantic_models.extraction_pipeline import (
            extract_facility_facts_with_confidence
        )
        
        facts = extract_facility_facts_with_confidence(
            organization="General Hospital",
            source_content=website_text,
            source_images=image_descriptions,
            llm_client=openai_client
        )
        
        # Access facts with confidence
        for proc in facts.procedure:
            print(f"{proc.fact} (confidence: {proc.confidence}/5)")
            print(f"Evidence: {proc.evidence}")
        ```
    """
    if source_images is None:
        source_images = []
    
    # Step 1: Extract facts with initial confidence using LLM
    # Replace this with your actual LLM API call
    initial_facts = _call_llm_for_extraction(
        organization=organization,
        source_content=source_content,
        source_images=source_images,
        llm_client=llm_client
    )
    
    # Step 2: Post-process and validate confidence scores
    scorer = ConfidenceScorer()
    validated_facts = scorer.validate_and_adjust_confidence(
        facts=initial_facts,
        source_content=source_content,
        source_images=source_images
    )
    
    return validated_facts


def _call_llm_for_extraction(
    organization: str,
    source_content: str,
    source_images: List[str],
    llm_client
) -> FacilityFacts:
    """
    Call LLM API to extract facts.
    
    This is a placeholder function. Replace with your actual LLM API integration.
    
    Example implementations:
    
    For OpenAI:
        ```python
        from openai import OpenAI
        from prompts_and_pydantic_models.free_form import FacilityFacts
        
        client = OpenAI()
        response = client.beta.chat.completions.parse(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": FREE_FORM_SYSTEM_PROMPT.format(organization=organization)},
                {"role": "user", "content": f"Content: {source_content}\n\nImages: {source_images}"}
            ],
            response_format=FacilityFacts
        )
        return response.choices[0].message.parsed
        ```
    
    For Anthropic:
        ```python
        from anthropic import Anthropic
        import json
        
        client = Anthropic()
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            system=FREE_FORM_SYSTEM_PROMPT.format(organization=organization),
            messages=[
                {"role": "user", "content": f"Content: {source_content}\n\nImages: {source_images}"}
            ]
        )
        # Parse JSON response into FacilityFacts
        return FacilityFacts.model_validate_json(response.content[0].text)
        ```
    """
    # Placeholder: This should be replaced with actual LLM API call
    # For now, return empty facts structure
    return FacilityFacts(
        procedure=[],
        equipment=[],
        capability=[]
    )


def format_facts_for_display(facts: FacilityFacts) -> str:
    """
    Format facts with confidence scores for display.
    
    Args:
        facts: FacilityFacts object
        
    Returns:
        Formatted string representation
    """
    output = []
    
    if facts.procedure:
        output.append("\n=== PROCEDURES ===")
        for proc in facts.procedure:
            stars = "★" * proc.confidence + "☆" * (5 - proc.confidence)
            output.append(f"\n{proc.fact}")
            output.append(f"Confidence: {stars} ({proc.confidence}/5)")
            if proc.evidence:
                output.append("Evidence:")
                for ev in proc.evidence[:2]:  # Show first 2 evidence snippets
                    output.append(f"  - {ev}")
    
    if facts.equipment:
        output.append("\n=== EQUIPMENT ===")
        for eq in facts.equipment:
            stars = "★" * eq.confidence + "☆" * (5 - eq.confidence)
            output.append(f"\n{eq.fact}")
            output.append(f"Confidence: {stars} ({eq.confidence}/5)")
            if eq.evidence:
                output.append("Evidence:")
                for ev in eq.evidence[:2]:
                    output.append(f"  - {ev}")
    
    if facts.capability:
        output.append("\n=== CAPABILITIES ===")
        for cap in facts.capability:
            stars = "★" * cap.confidence + "☆" * (5 - cap.confidence)
            output.append(f"\n{cap.fact}")
            output.append(f"Confidence: {stars} ({cap.confidence}/5)")
            if cap.evidence:
                output.append("Evidence:")
                for ev in cap.evidence[:2]:
                    output.append(f"  - {ev}")
    
    return "\n".join(output)
