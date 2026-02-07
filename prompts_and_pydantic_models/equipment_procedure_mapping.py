"""
Medical procedure to required equipment mapping knowledge base.

This module contains mappings between medical procedures and the equipment
required to perform them. Used for validating consistency between extracted
procedures and equipment facts.
"""

from typing import Dict, List, Set

# Mapping of procedures (keywords/phrases) to required equipment (keywords/phrases)
PROCEDURE_EQUIPMENT_MAPPING: Dict[str, List[str]] = {
    # Cardiac procedures
    "cardiac surgery": ["cardiac surgery equipment", "heart-lung machine", "cardiopulmonary bypass", "cardiac monitor", "defibrillator", "ICU", "anesthesia"],
    "heart surgery": ["cardiac surgery equipment", "heart-lung machine", "cardiopulmonary bypass", "cardiac monitor", "defibrillator", "ICU", "anesthesia"],
    "open heart surgery": ["heart-lung machine", "cardiopulmonary bypass", "cardiac surgery equipment", "ICU", "anesthesia"],
    "cardiac catheterization": ["cardiac catheterization lab", "catheterization equipment", "fluoroscopy", "angiography equipment"],
    "angioplasty": ["cardiac catheterization lab", "catheterization equipment", "stent", "balloon catheter"],
    "pacemaker": ["pacemaker", "cardiac catheterization lab", "fluoroscopy", "defibrillator"],
    
    # Imaging procedures
    "MRI": ["MRI scanner", "magnetic resonance imaging"],
    "CT scan": ["CT scanner", "computed tomography"],
    "X-ray": ["X-ray machine", "radiography equipment"],
    "ultrasound": ["ultrasound machine", "sonography equipment"],
    "mammography": ["mammography machine", "mammogram equipment"],
    "fluoroscopy": ["fluoroscopy equipment", "X-ray"],
    "angiography": ["angiography equipment", "catheterization lab", "fluoroscopy"],
    
    # Surgical procedures
    "robotic surgery": ["robotic surgical system", "da Vinci", "surgical robot"],
    "laparoscopic surgery": ["laparoscope", "endoscope", "surgical instruments", "operating room"],
    "endoscopic surgery": ["endoscope", "surgical instruments", "operating room"],
    "minimally invasive surgery": ["endoscope", "laparoscope", "surgical instruments", "operating room"],
    
    # Dialysis
    "hemodialysis": ["hemodialysis machine", "dialysis equipment", "dialysis unit"],
    "dialysis": ["dialysis machine", "hemodialysis equipment", "dialysis unit"],
    "peritoneal dialysis": ["peritoneal dialysis equipment", "dialysis supplies"],
    
    # Ophthalmology
    "cataract surgery": ["phacoemulsification equipment", "ophthalmic surgical equipment", "operating microscope"],
    "retinal surgery": ["retinal surgical equipment", "vitrectomy equipment", "operating microscope", "laser"],
    "laser eye surgery": ["laser", "ophthalmic laser", "eye surgery equipment"],
    
    # Orthopedic
    "joint replacement": ["orthopedic surgical equipment", "joint replacement instruments", "operating room"],
    "arthroscopy": ["arthroscope", "orthopedic surgical equipment", "operating room"],
    "fracture repair": ["orthopedic surgical equipment", "X-ray", "surgical instruments"],
    
    # Neurosurgery
    "brain surgery": ["neurosurgical equipment", "operating microscope", "neuronavigation", "ICU"],
    "neurosurgery": ["neurosurgical equipment", "operating microscope", "neuronavigation", "ICU"],
    "spinal surgery": ["neurosurgical equipment", "spinal surgical instruments", "operating room"],
    
    # Obstetrics/Gynecology
    "cesarean section": ["operating room", "obstetric surgical equipment", "anesthesia", "delivery room"],
    "hysterectomy": ["gynecological surgical equipment", "operating room", "laparoscope"],
    "IVF": ["IVF laboratory", "embryology equipment", "incubator", "microscope"],
    
    # Oncology
    "chemotherapy": ["chemotherapy infusion equipment", "IV infusion", "oncology unit"],
    "radiation therapy": ["linear accelerator", "radiation therapy equipment", "radiotherapy"],
    "brachytherapy": ["brachytherapy equipment", "radiation source"],
    
    # Emergency/Trauma
    "trauma surgery": ["trauma bay", "emergency surgical equipment", "ICU", "operating room"],
    "emergency surgery": ["emergency surgical equipment", "operating room", "trauma bay"],
    
    # General surgery
    "general surgery": ["operating room", "surgical instruments", "anesthesia"],
    "surgery": ["operating room", "surgical instruments", "anesthesia"],
    
    # Diagnostic procedures
    "endoscopy": ["endoscope", "endoscopy equipment"],
    "colonoscopy": ["colonoscope", "endoscopy equipment"],
    "bronchoscopy": ["bronchoscope", "endoscopy equipment"],
    "biopsy": ["biopsy equipment", "needle", "pathology equipment"],
    
    # Laboratory
    "laboratory testing": ["laboratory equipment", "analyzers", "microscope"],
    "blood testing": ["blood analyzer", "laboratory equipment"],
    "pathology": ["pathology equipment", "microscope", "laboratory"],
}


# Reverse mapping: equipment to procedures it supports
EQUIPMENT_PROCEDURE_MAPPING: Dict[str, List[str]] = {
    "MRI scanner": ["MRI", "magnetic resonance imaging"],
    "CT scanner": ["CT scan", "computed tomography"],
    "X-ray machine": ["X-ray", "radiography", "fracture diagnosis"],
    "ultrasound machine": ["ultrasound", "sonography", "prenatal care"],
    "da Vinci": ["robotic surgery", "minimally invasive surgery"],
    "robotic surgical system": ["robotic surgery", "minimally invasive surgery"],
    "hemodialysis machine": ["hemodialysis", "dialysis"],
    "cardiac catheterization lab": ["cardiac catheterization", "angioplasty", "pacemaker"],
    "operating room": ["surgery", "general surgery", "trauma surgery"],
    "ICU": ["critical care", "intensive care", "cardiac surgery", "trauma care"],
    "NICU": ["neonatal care", "premature infant care"],
    "anesthesia": ["surgery", "general surgery", "cardiac surgery"],
}


def get_required_equipment(procedure: str) -> Set[str]:
    """
    Get required equipment for a given procedure.
    
    Args:
        procedure: Procedure name or description
        
    Returns:
        Set of required equipment keywords/phrases
    """
    procedure_lower = procedure.lower()
    required_equipment = set()
    
    for proc_key, equipment_list in PROCEDURE_EQUIPMENT_MAPPING.items():
        if proc_key.lower() in procedure_lower:
            required_equipment.update(equipment_list)
    
    return required_equipment


def get_supported_procedures(equipment: str) -> Set[str]:
    """
    Get procedures that can be performed with given equipment.
    
    Args:
        equipment: Equipment name or description
        
    Returns:
        Set of supported procedure keywords/phrases
    """
    equipment_lower = equipment.lower()
    supported_procedures = set()
    
    for equip_key, procedure_list in EQUIPMENT_PROCEDURE_MAPPING.items():
        if equip_key.lower() in equipment_lower:
            supported_procedures.update(procedure_list)
    
    return supported_procedures


def check_equipment_procedure_consistency(
    procedure: str, 
    available_equipment: List[str]
) -> tuple[bool, List[str]]:
    """
    Check if a procedure has the required equipment available.
    
    Args:
        procedure: Procedure name or description
        available_equipment: List of available equipment
        
    Returns:
        Tuple of (is_consistent, missing_equipment)
    """
    required = get_required_equipment(procedure)
    if not required:
        # No specific requirements found, assume consistent
        return True, []
    
    available_set = {eq.lower() for eq in available_equipment}
    required_lower = {req.lower() for req in required}
    
    # Check if any required equipment is available
    found_equipment = []
    missing_equipment = []
    
    for req in required_lower:
        found = False
        for avail in available_set:
            if req in avail or avail in req:
                found = True
                found_equipment.append(req)
                break
        if not found:
            missing_equipment.append(req)
    
    # If we found at least one required equipment, consider it consistent
    # (some procedures may have multiple options)
    is_consistent = len(found_equipment) > 0
    
    return is_consistent, missing_equipment
