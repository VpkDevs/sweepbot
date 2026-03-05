/**
 * Entity Recognizer - NLP-based entity extraction
 * Recognizes platforms, games, actions, conditions, schedules, amounts, durations from natural language
 * Uses rule-based matching (70-80% coverage) with LLM fallback for ambiguous cases
 */
export class EntityRecognizer {
    platformAliases = new Map([
        // Normalize platform names to canonical forms
        ['chumba', 'chumba'],
        ['cc', 'chumba'],
        ['chumba casino', 'chumba'],
        ['luckyland', 'luckyland'],
        ['lucky', 'luckyland'],
        ['luckyland slots', 'luckyland'],
        ['stake', 'stake'],
        ['stake.us', 'stake'],
        ['pulsz', 'pulsz'],
        ['wow', 'wowvegas'],
        ['wow vegas', 'wowvegas'],
        ['wowvegas', 'wowvegas'],
        ['fortune', 'fortunecoins'],
        ['fortune coins', 'fortunecoins'],
        ['fortunecoins', 'fortunecoins'],
    ]);
    gameAliases = new Map([
        ['sweet bo', 'sweet_bonanza'],
        ['sweet bonanza', 'sweet_bonanza'],
        ['sb', 'sweet_bonanza'],
        ['gates', 'gates_of_olympus'],
        ['gates of olympus', 'gates_of_olympus'],
        ['olympus', 'gates_of_olympus'],
        ['sugar rush', 'sugar_rush'],
        ['sr', 'sugar_rush'],
        ['wildberries', 'wild_berries'],
        ['wild berries', 'wild_berries'],
    ]);
    /**
     * Extract platforms from text
     */
    extractPlatforms(text) {
        const platforms = [];
        const lowerText = text.toLowerCase();
        // Check each known platform
        for (const [alias, normalized] of this.platformAliases.entries()) {
            if (lowerText.includes(alias)) {
                platforms.push({
                    name: alias,
                    normalized,
                    confidence: 0.9,
                    aliases: [alias],
                });
            }
        }
        // Remove duplicates by normalized name
        const seen = new Set();
        return platforms.filter((p) => {
            if (seen.has(p.normalized))
                return false;
            seen.add(p.normalized);
            return true;
        });
    }
    /**
     * Extract games from text
     */
    extractGames(text) {
        const games = [];
        const lowerText = text.toLowerCase();
        for (const [alias, normalized] of this.gameAliases.entries()) {
            if (lowerText.includes(alias)) {
                games.push({
                    name: alias,
                    normalized,
                    confidence: 0.85,
                });
            }
        }
        const seen = new Set();
        return games.filter((g) => {
            if (seen.has(g.normalized))
                return false;
            seen.add(g.normalized);
            return true;
        });
    }
    /**
     * Extract actions from text
     */
    extractActions(text) {
        const actions = [];
        const lowerText = text.toLowerCase();
        // Action keywords mapping
        const actionKeywords = [
            { keywords: ['open', 'go to', 'visit'], action: 'open_platform', confidence: 0.9 },
            { keywords: ['log in', 'login', 'sign in'], action: 'login', confidence: 0.95 },
            { keywords: ['log out', 'logout', 'sign out'], action: 'logout', confidence: 0.95 },
            { keywords: ['claim', 'grab', 'get', 'daily bonus'], action: 'claim_bonus', confidence: 0.9 },
            { keywords: ['play', 'open game', 'spin'], action: 'open_game', confidence: 0.85 },
            { keywords: ['spin', 'pull'], action: 'spin', confidence: 0.9 },
            { keywords: ['bet', 'wager', 'throw'], action: 'bet', confidence: 0.85 },
            { keywords: ['balance', 'check balance', 'my balance'], action: 'check_balance', confidence: 0.9 },
            { keywords: ['cash out', 'withdraw', 'redeem'], action: 'cash_out', confidence: 0.9 },
            { keywords: ['close', 'exit', 'quit'], action: 'close_platform', confidence: 0.85 },
        ];
        for (const { keywords, action } of actionKeywords) {
            for (const keyword of keywords) {
                if (lowerText.includes(keyword)) {
                    actions.push({
                        text: keyword,
                        type: action,
                    });
                    break; // Don't add duplicate actions
                }
            }
        }
        return actions;
    }
    /**
     * Extract conditions from text
     * Looks for patterns like "if", "when", "unless", comparisons, etc.
     */
    extractConditions(text) {
        const conditions = [];
        const lowerText = text.toLowerCase();
        // Simple condition patterns: "if X > Y", "when balance drops", etc.
        const conditionPatterns = [
            /if\s+(?:i\s+)?(?:win|lose|hit)\s+(\w+)/gi,
            /if\s+(?:balance|bonus)\s+([<>]=?)\s+(\d+)/gi,
            /when\s+(\w+)\s+([<>]=?)\s+(\d+)/gi,
            /unless\s+(\w+)/gi,
            /until\s+(\w+)/gi,
        ];
        for (const pattern of conditionPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                conditions.push({
                    text: match[0],
                    type: 'comparison',
                    left: match[1],
                    operator: match[2],
                    right: match[3],
                });
            }
        }
        return conditions;
    }
    /**
     * Extract schedules from text
     * Parses "every day at 3:30", "weekdays", "once a week", etc.
     */
    extractSchedules(text) {
        const schedules = [];
        const lowerText = text.toLowerCase();
        // Daily patterns
        if (/every day|daily/i.test(text)) {
            const timeMatch = text.match(/at\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i);
            if (timeMatch) {
                const hour = this.normalizeHour(parseInt(timeMatch[1]), timeMatch[3]);
                const cron = `0 ${hour} * * *`; // daily at specific time
                schedules.push({
                    text: text.substring(0, text.indexOf('at') + 20),
                    cron,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    frequency: 'daily',
                });
            }
        }
        // Weekly patterns
        const weeklyMatch = text.match(/every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
        if (weeklyMatch) {
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const day = dayNames.indexOf(weeklyMatch[1].toLowerCase());
            schedules.push({
                text: weeklyMatch[0],
                cron: `0 9 * * ${day}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                frequency: 'weekly',
            });
        }
        return schedules;
    }
    /**
     * Extract amounts from text
     * Parses "$50", "minimum bet", "5x the bonus", etc.
     */
    extractAmounts(text) {
        const amounts = [];
        // Dollar amounts
        const dollarMatches = text.matchAll(/\$(\d+(?:\.\d{2})?)/g);
        for (const match of dollarMatches) {
            amounts.push({
                text: match[0],
                type: 'absolute',
                value: parseFloat(match[1]),
            });
        }
        // Relative amounts: "5x the bonus", "double my deposit"
        const relativeMatches = text.matchAll(/(\d+)x\s+(?:the\s+)?(\w+)/gi);
        for (const match of relativeMatches) {
            amounts.push({
                text: match[0],
                type: 'relative',
                multiplier: parseInt(match[1]),
                reference: match[2].toLowerCase(),
            });
        }
        // Keywords: "minimum bet", "max bet", "half my balance" (allow some reordering)
        if (/(minimum\s+bet)|(bet\s+the\s+minimum)/i.test(text)) {
            amounts.push({
                text: 'minimum bet',
                type: 'relative',
                reference: 'min_bet',
            });
        }
        if (/(maximum\s+bet|max\s+bet)|(bet\s+the\s+maximum)/i.test(text)) {
            amounts.push({
                text: 'maximum bet',
                type: 'relative',
                reference: 'max_bet',
            });
        }
        return amounts;
    }
    /**
     * Extract durations from text
     * Parses "30 minutes", "2 hours", "100 spins", etc.
     */
    extractDurations(text) {
        const durations = [];
        // Time durations
        const timeMatches = text.matchAll(/(\d+)\s+(minutes?|hours?)/gi);
        for (const match of timeMatches) {
            const unit = match[2].toLowerCase().startsWith('m') ? 'minutes' : 'hours';
            durations.push({
                text: match[0],
                type: 'time',
                value: parseInt(match[1]),
                unit,
            });
        }
        // Spin/session durations
        const spinMatches = text.matchAll(/(\d+)\s+(spins?|sessions?)/gi);
        for (const match of spinMatches) {
            const unit = match[2].toLowerCase().startsWith('s') && match[2].length < 8 ? 'spins' : 'sessions';
            durations.push({
                text: match[0],
                type: 'iteration',
                value: parseInt(match[1]),
                unit,
            });
        }
        // also catch "spin 100 times" or "run 100 spins"
        const spinCountMatches = text.matchAll(/spin(?:s)?\s+(\d+)/gi);
        for (const match of spinCountMatches) {
            durations.push({
                text: match[0],
                type: 'iteration',
                value: parseInt(match[1]),
                unit: 'spins',
            });
        }
        return durations;
    }
    /**
     * Recognize all entities in the text
     */
    recognize(text) {
        return {
            platforms: this.extractPlatforms(text),
            games: this.extractGames(text),
            actions: this.extractActions(text),
            conditions: this.extractConditions(text),
            schedules: this.extractSchedules(text),
            amounts: this.extractAmounts(text),
            durations: this.extractDurations(text),
            variables: this.extractVariables(text),
        };
    }
    /**
     * Extract variable references from text
     * Parses "$BONUS", "$BALANCE", etc.
     */
    extractVariables(text) {
        const variables = [];
        const varMatches = text.matchAll(/\$([A-Z_]+)/g);
        for (const match of varMatches) {
            const varName = match[1];
            variables.push({
                name: varName,
                source: 'action_result',
                type: 'number',
            });
        }
        return variables;
    }
    /**
     * Helper: normalize hour to 24-hour format
     */
    normalizeHour(hour, meridiem) {
        if (!meridiem)
            return hour; // Already in 24-hour format
        const pm = meridiem.toLowerCase() === 'pm';
        if (pm && hour !== 12)
            return hour + 12;
        if (!pm && hour === 12)
            return 0;
        return hour;
    }
}
//# sourceMappingURL=entity-recognizer.js.map