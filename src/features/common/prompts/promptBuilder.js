const { profilePrompts } = require('./promptTemplates.js');

function buildSystemPrompt(promptParts, customPrompt = '', googleSearchEnabled = true) {
    const sections = [promptParts.intro, '\n\n', promptParts.formatRequirements];

    if (googleSearchEnabled) {
        sections.push('\n\n', promptParts.searchUsage);
    }

    sections.push('\n\n', promptParts.content, '\n\nUser-provided context\n-----\n', customPrompt, '\n-----\n\n', promptParts.outputInstructions);

    return sections.join('');
}

function getSystemPrompt(profile, customPrompt = '', googleSearchEnabled = true, lang = null) {
    const promptParts = profilePrompts[profile] || profilePrompts.interview;
    if (lang === 'en' && profile === 'pickle_glass') {
        const enParts = {
            ...promptParts,
            outputInstructions: `RULES:
- ENGLISH ONLY (SQL/code — English)
- For tasks: start immediately with the solution, no preamble
- For verbal answers: first person as a candidate
- SQL — always full working code with indentation
- Test cases — always in table or numbered list format
- DO NOT mention you are an AI`,
        };
        return buildSystemPrompt(enParts, customPrompt, googleSearchEnabled);
    }
    return buildSystemPrompt(promptParts, customPrompt, googleSearchEnabled);
}

module.exports = {
    getSystemPrompt,
};
