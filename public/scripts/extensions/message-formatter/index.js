/**
 * Message Formatter extension
 *
 * Integrates the extracted "message-formatter" logic into the main SillyTavern
 * rendering pipeline via the official `MessageFormatter.addHook()` extension point.
 *
 * Background
 * ----------
 * SillyTavern 1.19 already handles the bulk of the formatting natively:
 *   - `fixMarkdown()`          -> public/scripts/power-user.js
 *   - quote detection (`<q>`)  -> public/script.js (messageFormatting)
 *   - Markdown -> HTML         -> showdown (public/script.js)
 *   - the three theme colours   -> public/style.css (:root)
 *
 * What the upstream still lacks (and what this extension adds):
 *   - `.mes_text del / s / strike`  -> strikethrough is not styled
 *   - `.mes_text a`                  -> links are not coloured
 *   - `.mes_text h3 / h4`            -> no heading sizing
 *   - `.mes_text code`               -> inline code has no background
 *   - `.mes_text hr`                 -> no accent-coloured separator
 *   - `quotes: none` on `<q>`        -> the browser renders extra quote glyphs
 *
 * The `fixMarkdown()` / quote-detection logic is deliberately NOT re-run here,
 * because upstream already applies it and running it twice would produce
 * double-wrapped `<q>` elements.
 */

import { extension_settings, renderExtensionTemplateAsync } from '../../extensions.js';
import { saveSettingsDebounced } from '../../../script.js';
import { getContext } from '../../st-context.js';
import { formatting_stage, hook_order } from '../../message-formatter.js';
import { fixMarkdown, processQuotes } from './lib/message-formatter-standalone.js';

const extensionName = 'message-formatter';

/**
 * Default extension settings.
 * @type {object}
 */
const defaultSettings = {
    enabled: true,
    /** Auto-fix unbalanced Markdown markers before rendering. */
    autoFixMarkdown: true,
    /** Wrap quoted spans in `<q>` tags (upstream already does this). */
    processQuotes: true,
    /** Show a hint bar inside the chat when the extension is active. */
    showIndicator: false,
};

/**
 * Ensures the extension settings namespace exists and is populated with defaults.
 * @returns {void}
 */
function initSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = structuredClone(defaultSettings);
    }
    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings[extensionName][key] === undefined) {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }
}

/**
 * Removes the stray quote glyphs that browsers render for `<q>` elements.
 * @param {string} html Message HTML
 * @returns {string} Message HTML without the stray glyphs
 */
function stripQuoteGlyphs(html) {
    return html.replace(/<q>/g, '<q style="quotes: none;">');
}

/**
 * The formatting hook registered on the `beforeRegex` stage.
 *
 * At this point the message is still plain Markdown, so it is the right place
 * to repair unbalanced markers. Upstream only runs `fixMarkdown()` later, and
 * only when `power_user.auto_fix_generated_markdown` is enabled — this hook
 * makes the behaviour explicit and independent of that setting.
 *
 * @param {string} mes Message text
 * @returns {string} Message text
 */
function onBeforeRegex(mes) {
    if (!extension_settings[extensionName].autoFixMarkdown) {
        return mes;
    }
    return fixMarkdown(mes, true);
}

/**
 * The formatting hook registered on the `afterRegex` stage.
 *
 * Quotes are converted here rather than relying on the upstream implementation,
 * which runs the same conversion later in the pipeline. Doing it at this stage
 * keeps the behaviour under the control of this extension's settings.
 *
 * @param {string} mes Message text
 * @returns {string} Message text
 */
function onAfterRegex(mes) {
    if (!extension_settings[extensionName].processQuotes) {
        return mes;
    }
    return processQuotes(mes);
}

/**
 * The formatting hook registered on the `afterMarkdown` stage.
 *
 * At this point the message is an HTML string, ready to be inserted into the
 * DOM. Only cosmetic adjustments are performed here.
 *
 * @param {string} mes Message HTML
 * @returns {string} Message HTML
 */
function onAfterMarkdown(mes) {
    return stripQuoteGlyphs(mes);
}

/**
 * Registers the formatting hooks with the message formatter pipeline.
 * @returns {void}
 */
function registerHooks() {
    const { messageFormatter } = getContext();

    if (!messageFormatter) {
        console.warn('[Message Formatter] The message formatter pipeline is unavailable.');
        return;
    }

    messageFormatter.addHook(onBeforeRegex, {
        stage: formatting_stage.BEFORE_REGEX,
        order: hook_order.EARLY,
    });

    messageFormatter.addHook(onAfterRegex, {
        stage: formatting_stage.AFTER_REGEX,
        order: hook_order.EARLY,
    });

    messageFormatter.addHook(onAfterMarkdown, {
        stage: formatting_stage.AFTER_MARKDOWN,
        order: hook_order.LATE,
    });
}

/**
 * Renders the extension settings panel.
 * @returns {Promise<void>}
 */
async function renderSettings() {
    const container = document.getElementById('extensions_settings');
    if (!container) {
        return;
    }

    const html = await renderExtensionTemplateAsync(extensionName, 'settings');
    const holder = document.createElement('div');
    holder.id = 'message-formatter_container';
    holder.className = 'extension_container';
    holder.innerHTML = html;
    container.appendChild(holder);

    const settings = extension_settings[extensionName];

    const enabledInput = holder.querySelector('#message_formatter_enabled');
    const autoFixInput = holder.querySelector('#message_formatter_auto_fix');
    const quotesInput = holder.querySelector('#message_formatter_quotes');

    if (!enabledInput || !autoFixInput || !quotesInput) {
        return;
    }

    enabledInput.checked = settings.enabled;
    autoFixInput.checked = settings.autoFixMarkdown;
    quotesInput.checked = settings.processQuotes;

    enabledInput.addEventListener('change', () => {
        settings.enabled = enabledInput.checked;
        saveSettingsDebounced();
        document.body.classList.toggle('message-formatter-disabled', !settings.enabled);
    });

    autoFixInput.addEventListener('change', () => {
        settings.autoFixMarkdown = autoFixInput.checked;
        saveSettingsDebounced();
    });

    quotesInput.addEventListener('change', () => {
        settings.processQuotes = quotesInput.checked;
        saveSettingsDebounced();
    });

    document.body.classList.toggle('message-formatter-disabled', !settings.enabled);
}

/**
 * Extension entry point.
 * @returns {Promise<void>}
 */
export async function init() {
    initSettings();
    registerHooks();
    await renderSettings();

    console.log('[Message Formatter] Loaded.');
}
