def get_persona_prompt(context: dict) -> str:
    """
    Builds a persona instructions string based on user preferences in context.
    """
    gender = context.get("gender", "")
    age_group = context.get("ageGroup", "")
    language = context.get("language", "")
    culture = context.get("culture", "")
    writing_style = context.get("writingStyle", "")
    creativity = context.get("creativityLevel", "")
    interests = context.get("interests", "")
    custom_rules = context.get("customRules", "")

    instructions = []
    
    if age_group:
        instructions.append(f"- User Age Group: {age_group}")
    if gender:
        instructions.append(f"- User Identity: {gender}")
    if language:
        instructions.append(f"- Primary Language: {language}")
    if culture:
        instructions.append(f"- Cultural Context: {culture}")
    if writing_style:
        instructions.append(f"- Preferred Writing Style: {writing_style}")
    if creativity:
        instructions.append(f"- Desired Creativity Level: {creativity}")
    if interests:
        instructions.append(f"- User Interests: {interests}")
    
    persona_str = ""
    if instructions:
        persona_str = "## USER PERSONALIZATION\n" + "\n".join(instructions) + "\n\n"
        
    if custom_rules:
        persona_str += f"## STRICT USER RULES (CRITICAL OVERRIDE)\n{custom_rules}\n\n"
        
    return persona_str
