"""
Confidence scoring and validation module for facility facts.

This module post-processes extracted facts to validate and adjust confidence scores
based on multiple signals: reference counting, equipment-procedure consistency,
and cross-category validation.
"""

import re
from typing import Dict, List, Optional

from .equipment_procedure_mapping import check_equipment_procedure_consistency
from .evidence_extractor import EvidenceExtractor
from .free_form import FacilityFacts, FactWithConfidence


class ConfidenceScorer:
    """Validates and adjusts confidence scores for extracted facts."""
    
    def __init__(self):
        """Initialize the confidence scorer."""
        self.evidence_extractor = EvidenceExtractor()
    
    def validate_and_adjust_confidence(
        self,
        facts: FacilityFacts,
        source_content: str,
        source_images: Optional[List[str]] = None
    ) -> FacilityFacts:
        """
        Post-process extracted facts to validate and adjust confidence scores.
        
        Args:
            facts: Extracted facts with initial confidence scores
            source_content: Original source text content
            source_images: Optional list of image descriptions
            
        Returns:
            FacilityFacts with adjusted confidence scores and enhanced evidence
        """
        if source_images is None:
            source_images = []
        
        # Process each category
        validated_procedures = self._validate_facts(
            facts.procedure or [],
            source_content,
            source_images,
            fact_type="procedure"
        )
        
        validated_equipment = self._validate_facts(
            facts.equipment or [],
            source_content,
            source_images,
            fact_type="equipment"
        )
        
        validated_capabilities = self._validate_facts(
            facts.capability or [],
            source_content,
            source_images,
            fact_type="capability"
        )
        
        # Cross-validate across categories
        validated_procedures = self._cross_validate_procedures(
            validated_procedures,
            validated_equipment,
            validated_capabilities
        )
        
        validated_equipment = self._cross_validate_equipment(
            validated_equipment,
            validated_procedures,
            validated_capabilities
        )
        
        validated_capabilities = self._cross_validate_capabilities(
            validated_capabilities,
            validated_procedures,
            validated_equipment
        )
        
        return FacilityFacts(
            procedure=validated_procedures if validated_procedures else None,
            equipment=validated_equipment if validated_equipment else None,
            capability=validated_capabilities if validated_capabilities else None
        )
    
    def _validate_facts(
        self,
        facts: List[FactWithConfidence],
        source_content: str,
        source_images: List[str],
        fact_type: str
    ) -> List[FactWithConfidence]:
        """
        Validate and adjust confidence for a list of facts.
        
        Args:
            facts: List of facts to validate
            source_content: Source text content
            source_images: Image descriptions
            fact_type: Type of facts ("procedure", "equipment", "capability")
            
        Returns:
            List of validated facts with adjusted confidence
        """
        validated = []
        
        for fact in facts:
            # Count references in source
            reference_count = self.evidence_extractor.count_references(
                fact.fact,
                source_content
            )
            
            # Extract additional evidence if missing or sparse
            if not fact.evidence or len(fact.evidence) < 2:
                text_evidence = self.evidence_extractor.extract_evidence_snippets(
                    fact.fact,
                    source_content,
                    max_snippets=3
                )
                
                # Merge with existing evidence
                existing_evidence = set(fact.evidence)
                for ev in text_evidence:
                    if ev not in existing_evidence:
                        fact.evidence.append(ev)
            
            # Extract image evidence
            image_evidence = self.evidence_extractor.extract_image_evidence(
                fact.fact,
                source_images
            )
            for img_ev in image_evidence:
                if img_ev not in fact.evidence:
                    fact.evidence.append(f"Image: {img_ev}")
            
            # Adjust confidence based on reference count
            adjusted_confidence = self._adjust_confidence_by_references(
                fact.confidence,
                reference_count
            )
            
            # Adjust confidence based on evidence quality
            adjusted_confidence = self._adjust_confidence_by_evidence_quality(
                adjusted_confidence,
                fact.evidence,
                fact.fact
            )
            
            # Create updated fact
            validated_fact = FactWithConfidence(
                fact=fact.fact,
                confidence=adjusted_confidence,
                evidence=fact.evidence,
                source_locations=fact.source_locations
            )
            
            validated.append(validated_fact)
        
        return validated
    
    def _adjust_confidence_by_references(
        self,
        initial_confidence: int,
        reference_count: int
    ) -> int:
        """
        Adjust confidence based on how many times fact is referenced.
        
        Args:
            initial_confidence: Initial confidence score (1-5)
            reference_count: Number of references found
            
        Returns:
            Adjusted confidence score (1-5)
        """
        if reference_count >= 5:
            # High frequency: boost confidence
            adjustment = +1
        elif reference_count >= 3:
            # Medium frequency: slight boost
            adjustment = +0.5
        elif reference_count == 1:
            # Single mention: maintain
            adjustment = 0
        else:
            # No direct mention: reduce
            adjustment = -1
        
        # Apply adjustment and clamp to 1-5 range
        new_confidence = int(initial_confidence + adjustment)
        return max(1, min(5, new_confidence))
    
    def _adjust_confidence_by_evidence_quality(
        self,
        current_confidence: int,
        evidence: List[str],
        fact: str
    ) -> int:
        """
        Adjust confidence based on evidence quality.
        
        Args:
            current_confidence: Current confidence score
            evidence: List of evidence snippets
            fact: The fact statement
            
        Returns:
            Adjusted confidence score
        """
        if not evidence:
            # No evidence: reduce confidence
            return max(1, current_confidence - 1)
        
        # Check for specific details (numbers, model names, dates)
        has_specifics = False
        for ev in evidence:
            # Check for numbers (quantities, dates, model numbers)
            if re.search(r'\d+', ev):
                has_specifics = True
                break
            # Check for model names (capitalized words, brand names)
            if re.search(r'\b[A-Z][a-z]+ [A-Z][a-z]+', ev):
                has_specifics = True
                break
        
        if has_specifics and len(evidence) >= 2:
            # Multiple evidence sources with specifics: boost
            return int(min(5, current_confidence + 1))
        elif has_specifics:
            # Specifics but single source: slight boost
            return int(min(5, current_confidence + 0.5))
        elif len(evidence) >= 2:
            # Multiple sources but vague: maintain
            return int(current_confidence)
        else:
            # Single vague source: slight reduction
            return int(max(1, current_confidence - 0.5))
    
    def _cross_validate_procedures(
        self,
        procedures: List[FactWithConfidence],
        equipment: List[FactWithConfidence],
        capabilities: List[FactWithConfidence]
    ) -> List[FactWithConfidence]:
        """
        Cross-validate procedures against equipment and capabilities.
        
        Args:
            procedures: List of procedure facts
            equipment: List of equipment facts
            capabilities: List of capability facts
            
        Returns:
            List of validated procedures with adjusted confidence
        """
        equipment_facts = [eq.fact for eq in equipment]
        validated = []
        
        for proc in procedures:
            confidence = proc.confidence
            
            # Check if procedure has required equipment
            is_consistent, missing = check_equipment_procedure_consistency(
                proc.fact,
                equipment_facts
            )
            
            if is_consistent:
                # Procedure has required equipment: boost confidence
                confidence = min(5, confidence + 0.5)
            elif missing:
                # Procedure lacks required equipment: reduce confidence
                confidence = max(1, confidence - 1)
            
            # Check if procedure aligns with stated capabilities
            proc_lower = proc.fact.lower()
            for cap in capabilities:
                cap_lower = cap.fact.lower()
                # Check for alignment (e.g., "cardiac surgery" aligns with "cardiac care")
                if any(keyword in cap_lower for keyword in proc_lower.split()[:2]):
                    # Aligned: slight boost
                    confidence = min(5, confidence + 0.3)
                    break
            
            validated.append(FactWithConfidence(
                fact=proc.fact,
                confidence=int(confidence),
                evidence=proc.evidence,
                source_locations=proc.source_locations
            ))
        
        return validated
    
    def _cross_validate_equipment(
        self,
        equipment: List[FactWithConfidence],
        procedures: List[FactWithConfidence],
        capabilities: List[FactWithConfidence]
    ) -> List[FactWithConfidence]:
        """
        Cross-validate equipment against procedures and capabilities.
        
        Args:
            equipment: List of equipment facts
            procedures: List of procedure facts
            capabilities: List of capability facts
            
        Returns:
            List of validated equipment with adjusted confidence
        """
        procedure_facts = [proc.fact for proc in procedures]
        validated = []
        
        for eq in equipment:
            confidence = eq.confidence
            
            # Check if equipment supports any procedures
            from .equipment_procedure_mapping import get_supported_procedures
            supported_procs = get_supported_procedures(eq.fact)
            
            if supported_procs:
                # Check if any supported procedure is actually performed
                eq_supports_procedure = False
                for proc_fact in procedure_facts:
                    proc_lower = proc_fact.lower()
                    if any(sp.lower() in proc_lower for sp in supported_procs):
                        eq_supports_procedure = True
                        break
                
                if eq_supports_procedure:
                    # Equipment supports stated procedures: boost confidence
                    confidence = min(5, confidence + 0.5)
                else:
                    # Equipment doesn't support any stated procedures: reduce
                    # (unless it's general infrastructure like ICU, operating room)
                    general_equipment = ['icu', 'operating room', 'emergency', 'laboratory']
                    if not any(gen in eq.fact.lower() for gen in general_equipment):
                        confidence = max(1, confidence - 0.5)
            
            validated.append(FactWithConfidence(
                fact=eq.fact,
                confidence=int(confidence),
                evidence=eq.evidence,
                source_locations=eq.source_locations
            ))
        
        return validated
    
    def _cross_validate_capabilities(
        self,
        capabilities: List[FactWithConfidence],
        procedures: List[FactWithConfidence],
        equipment: List[FactWithConfidence]
    ) -> List[FactWithConfidence]:
        """
        Cross-validate capabilities against procedures and equipment.
        
        Args:
            capabilities: List of capability facts
            procedures: List of procedure facts
            equipment: List of equipment facts
            
        Returns:
            List of validated capabilities with adjusted confidence
        """
        validated = []
        
        for cap in capabilities:
            confidence = cap.confidence
            
            # Check if capability is supported by procedures or equipment
            cap_lower = cap.fact.lower()
            supported = False
            
            # Check procedures
            for proc in procedures:
                proc_lower = proc.fact.lower()
                # Check for keyword alignment
                cap_keywords = set(cap_lower.split()[:3])
                proc_keywords = set(proc_lower.split()[:3])
                if len(cap_keywords & proc_keywords) > 0:
                    supported = True
                    break
            
            # Check equipment
            if not supported:
                for eq in equipment:
                    eq_lower = eq.fact.lower()
                    cap_keywords = set(cap_lower.split()[:3])
                    eq_keywords = set(eq_lower.split()[:3])
                    if len(cap_keywords & eq_keywords) > 0:
                        supported = True
                        break
            
            if supported:
                # Capability supported by procedures/equipment: boost
                confidence = min(5, confidence + 0.5)
            else:
                # Capability not clearly supported: slight reduction
                confidence = max(1, confidence - 0.3)
            
            validated.append(FactWithConfidence(
                fact=cap.fact,
                confidence=int(confidence),
                evidence=cap.evidence,
                source_locations=cap.source_locations
            ))
        
        return validated
