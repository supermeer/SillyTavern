/**
 * SillyTavern 消息格式化独立模块
 * 提取自 SillyTavern 源代码，用于将文本消息转换为带样式的 HTML
 *
 * 主要功能：
 * 1. Markdown 格式解析 (*斜体*, **粗体**, __下划线__ 等)
 * 2. 引号识别和高亮 ("对话", 「日文引号」等)
 * 3. 自动修复不配对的 Markdown 标记
 * 4. HTML 安全处理
 */

// ============================================================================
// 配置选项
// ============================================================================

const DEFAULT_CONFIG = {
    // 是否启用自动修复 Markdown 格式
    autoFixMarkdown: true,

    // 是否将 HTML 标签编码（防止注入）
    encodeTags: false,

    // 样式颜色配置（CSS 变量值）
    colors: {
        em: 'rgb(145, 145, 145)', // 斜体/心理活动颜色（灰色）
        quote: 'rgb(225, 138, 36)', // 引号/对话颜色（橙色）
        underline: 'rgb(188, 231, 207)', // 下划线颜色（青绿色）
    },

    // Markdown 转换配置
    markdown: {
        emoji: true,
        literalMidWordUnderscores: true,
        parseImgDimensions: true,
        tables: true,
        underline: true,
        simpleLineBreaks: true,
        strikethrough: true,
    },
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 转义 HTML 特殊字符
 * @param {string} str 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * 计算字符串中某个字符出现的次数
 * @param {string} string 要搜索的字符串
 * @param {string} character 要查找的字符
 * @returns {number} 出现次数
 */
function countOccurrences(string, character) {
    let count = 0;
    for (let i = 0; i < string.length; i++) {
        if (string.substring(i, i + character.length) === character) {
            count++;
        }
    }
    return count;
}

/**
 * 判断数字是否为奇数
 * @param {number} number 要判断的数字
 * @returns {boolean} 是否为奇数
 */
function isOdd(number) {
    return number % 2 !== 0;
}

// ============================================================================
// Markdown 修复函数
// ============================================================================

/**
 * 修复 Markdown 格式问题
 *
 * 主要功能：
 * 1. 移除星号和下划线周围多余的空格
 * 2. 自动补全不配对的星号和引号
 *
 * @param {string} text 原始文本
 * @param {boolean} forDisplay 是否用于显示（会补全不配对的标记）
 * @returns {string} 修复后的文本
 *
 * @example
 * fixMarkdown("这是 * 一个测试 *", true)  // => "这是 *一个测试*"
 * fixMarkdown("这是一行有奇数个星号的文本*", true)  // => "这是一行有奇数个星号的文本**"
 */
function fixMarkdown(text, forDisplay = true) {
    // 查找所有配对的格式字符（* 或 _）
    const format = /([*_]{1,2})([\s\S]*?)\1/gm;
    let matches = [];
    let match;

    while ((match = format.exec(text)) !== null) {
        matches.push(match);
    }

    // 移除格式字符周围的空格
    // 例如：* 文本 * => *文本*
    let newText = text;
    for (let i = matches.length - 1; i >= 0; i--) {
        let matchText = matches[i][0];
        // 匹配各种空白字符（空格、制表符、全角空格等）
        let replacementText = matchText.replace(
            /(\*|_)([\t \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]+)|([\t \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]+)(\*|_)/g,
            '$1$4',
        );
        newText =
            newText.slice(0, matches[i].index) +
            replacementText +
            newText.slice(matches[i].index + matchText.length);
    }

    // 如果不是用于显示，就不需要补全不配对的标记
    if (!forDisplay) {
        return newText;
    }

    // 自动补全每行不配对的星号和引号
    const splitText = newText.split('\n');
    for (let index = 0; index < splitText.length; index++) {
        const line = splitText[index];
        const charsToCheck = ['*', '"'];

        for (const char of charsToCheck) {
            // 如果该行某个字符出现奇数次，在行尾补上一个
            if (line.includes(char) && isOdd(countOccurrences(line, char))) {
                splitText[index] = line.trimEnd() + char;
            }
        }
    }

    newText = splitText.join('\n');
    return newText;
}

// ============================================================================
// 引号处理函数
// ============================================================================

/**
 * 将各种引号包裹的文本转换为 <q> 标签
 *
 * 支持的引号类型：
 * - 英文双引号: "text"
 * - 弯引号: "text"
 * - 法文引号: «text»
 * - 日文直角引号: 「text」
 * - 日文双直角引号: 『text』
 * - 全角引号: ＂text＂
 *
 * @param {string} text 原始文本
 * @returns {string} 处理后的文本
 *
 * @example
 * processQuotes('"你好"')  // => '<q>"你好"</q>'
 * processQuotes('「こんにちは」')  // => '<q>「こんにちは」</q>'
 */
function processQuotes(text) {
    // 正则表达式排除代码块和引号内容
    const quoteRegex =
        /<style>[\s\S]*?<\/style>|```[\s\S]*?```|~~~[\s\S]*?~~~|``[\s\S]*?``|`[\s\S]*?`|(".*?")|(\u201C.*?\u201D)|(\u00AB.*?\u00BB)|(\u300C.*?\u300D)|(\u300E.*?\u300F)|(\uFF02.*?\uFF02)/gim;

    return text.replace(quoteRegex, function (match, p1, p2, p3, p4, p5, p6) {
        if (p1) {
            // 英文双引号 "text"
            return `<q>"${p1.slice(1, -1)}"</q>`;
        } else if (p2) {
            // 弯引号 "text"
            return `<q>"${p2.slice(1, -1)}"</q>`;
        } else if (p3) {
            // 法文引号 «text»
            return `<q>«${p3.slice(1, -1)}»</q>`;
        } else if (p4) {
            // 日文直角引号 「text」
            return `<q>「${p4.slice(1, -1)}」</q>`;
        } else if (p5) {
            // 日文双直角引号 『text』
            return `<q>『${p5.slice(1, -1)}』</q>`;
        } else if (p6) {
            // 全角引号 ＂text＂
            return `<q>＂${p6.slice(1, -1)}＂</q>`;
        } else {
            // 代码块等，保持不变
            return match;
        }
    });
}

// ============================================================================
// 简化版 Markdown 转换器
// ============================================================================

/**
 * 简化版 Markdown 转 HTML 转换器
 * 注意：这是一个简化实现，完整版需要使用 Showdown.js 库
 *
 * @param {string} text Markdown 文本
 * @returns {string} HTML 文本
 */
function simpleMarkdownToHtml(text) {
    let html = text;

    // 1. 粗体：**text** 或 __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<u>$1</u>');

    // 2. 斜体：*text* 或 _text_
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');

    // 3. 删除线：~~text~~
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // 4. 行内代码：`code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 5. 换行：两个空格 + 换行 或 <br>
    html = html.replace(/ {2}\n/g, '<br>');
    html = html.replace(/\n/g, '<br>');

    return html;
}

// ============================================================================
// 主格式化函数
// ============================================================================

/**
 * 将文本消息格式化为 HTML（核心函数）
 *
 * 处理流程：
 * 1. 自动修复 Markdown 格式（可选）
 * 2. HTML 转义（可选）
 * 3. 处理引号
 * 4. Markdown 转 HTML
 * 5. 添加样式
 *
 * @param {string} text 原始消息文本
 * @param {object} config 配置选项
 * @returns {string} 格式化后的 HTML
 *
 * @example
 * const text = '*思考着* "你好啊" 这是**粗体**文本';
 * const html = formatMessage(text);
 * // 结果：
 * // <em>思考着</em> <q>"你好啊"</q> 这是<strong>粗体</strong>文本
 */
function formatMessage(text, config = {}) {
    // 合并配置
    const cfg = { ...DEFAULT_CONFIG, ...config };

    if (!text) {
        return '';
    }

    let mes = text;

    // ========================================================================
    // 步骤 1: 自动修复 Markdown 格式
    // ========================================================================
    if (cfg.autoFixMarkdown) {
        mes = fixMarkdown(mes, true);
    }

    // ========================================================================
    // 步骤 2: HTML 转义（防止注入）
    // ========================================================================
    if (cfg.encodeTags) {
        mes = mes.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    }

    // ========================================================================
    // 步骤 3: 处理引号（在 Markdown 转换之前）
    // ========================================================================
    if (!cfg.encodeTags) {
        // 临时保护 HTML 标签中的引号
        mes = mes.replace(/<([^>]+)>/g, function (_, contents) {
            return '<' + contents.replace(/"/g, '\ufffe') + '>';
        });
    }

    mes = processQuotes(mes);

    if (!cfg.encodeTags) {
        // 恢复 HTML 标签中的引号
        mes = mes.replace(/\ufffe/g, '"');
    }

    // ========================================================================
    // 步骤 4: LaTeX 数学公式转换
    // ========================================================================
    mes = mes.replaceAll('\\begin{align*}', '$$');
    mes = mes.replaceAll('\\end{align*}', '$$');

    // ========================================================================
    // 步骤 5: Markdown 转 HTML
    // ========================================================================
    // 注意：这里使用简化版转换器
    // 实际使用时建议引入 Showdown.js: https://github.com/showdownjs/showdown
    mes = simpleMarkdownToHtml(mes);

    // ========================================================================
    // 步骤 6: 清理和修整
    // ========================================================================
    mes = mes.trim();

    return mes;
}

// ============================================================================
// 生成完整的 HTML（包含样式）
// ============================================================================

/**
 * 生成完整的 HTML 片段（包含内联样式）
 *
 * @param {string} text 原始消息文本
 * @param {object} config 配置选项
 * @returns {string} 包含样式的完整 HTML
 *
 * @example
 * const html = formatMessageWithStyles('*思考* "说话"');
 * console.log(html);
 * // 输出带完整样式的 HTML
 */
function formatMessageWithStyles(text, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const content = formatMessage(text, cfg);

    return `
<div class="message-text" style="font-family: sans-serif; line-height: 1.6;">
    <style>
        .message-text em,
        .message-text i {
            color: ${cfg.colors.em};
            font-style: italic;
        }
        
        .message-text q {
            color: ${cfg.colors.quote};
            quotes: none;
        }
        
        .message-text q em,
        .message-text q i {
            color: inherit;
        }
        
        .message-text u {
            color: ${cfg.colors.underline};
            text-decoration: underline;
        }
        
        .message-text strong {
            font-weight: bold;
        }
        
        .message-text code {
            background-color: rgba(0, 0, 0, 0.1);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
        }
        
        .message-text blockquote {
            border-left: 3px solid ${cfg.colors.quote};
            padding-left: 10px;
            background-color: rgba(0, 0, 0, 0.05);
            margin: 0;
        }
    </style>
    ${content}
</div>`.trim();
}

// ============================================================================
// CSS 样式表（可单独使用）
// ============================================================================

/**
 * 获取 CSS 样式表字符串
 * 可以将此样式表添加到 HTML 文档的 <style> 标签中
 */
function getStylesheet(config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    return `
/* SillyTavern 消息样式 */

/* 斜体/心理活动 - 灰色 */
.mes_text em,
.mes_text i {
    color: ${cfg.colors.em};
    font-style: italic;
}

/* 引号/对话 - 橙色 */
.mes_text q {
    color: ${cfg.colors.quote};
    quotes: none; /* 移除浏览器默认引号 */
}

/* 引号中的斜体继承引号颜色 */
.mes_text q em,
.mes_text q i {
    color: inherit;
}

/* 下划线 - 青绿色 */
.mes_text u {
    color: ${cfg.colors.underline};
    text-decoration: underline;
}

/* 粗体 */
.mes_text strong {
    font-weight: bold;
}

/* 块引用 */
.mes_text blockquote {
    border-left: 3px solid ${cfg.colors.quote};
    padding-left: 10px;
    background-color: rgba(0, 0, 0, 0.05);
    margin: 0;
}

/* 代码块 */
.mes_text pre code {
    position: relative;
    display: block;
    overflow-x: auto;
    padding: 1em;
    background-color: rgba(0, 0, 0, 0.1);
}

/* 行内代码 */
.mes_text code {
    background-color: rgba(0, 0, 0, 0.1);
    padding: 2px 4px;
    border-radius: 3px;
    font-family: monospace;
}
`.trim();
}

// ============================================================================
// 导出
// ============================================================================

// ES Module 环境（作为扩展被主程序 import 时使用）
export {
    formatMessage,
    formatMessageWithStyles,
    getStylesheet,
    fixMarkdown,
    processQuotes,
    escapeHtml,
    simpleMarkdownToHtml,
    DEFAULT_CONFIG,
};

// 浏览器环境（供独立的演示页面使用）
if (typeof window !== 'undefined') {
    window.MessageFormatter = {
        formatMessage,
        formatMessageWithStyles,
        getStylesheet,
        fixMarkdown,
        processQuotes,
        escapeHtml,
        simpleMarkdownToHtml,
        DEFAULT_CONFIG,
    };
}

// ============================================================================
// 使用示例
// ============================================================================

/* eslint-disable no-unused-vars */

/**
 * 示例 1: 基本使用
 */
function example1() {
    const text = '*小心地观察着周围* "你好，很高兴见到你！" 她微笑着说。';
    const html = formatMessage(text);
    console.log(html);
    // 输出：<em>小心地观察着周围</em> <q>"你好，很高兴见到你！"</q> 她微笑着说。
}

/**
 * 示例 2: 带完整样式的 HTML
 */
function example2() {
    const text = '*思考了一下* "这确实是个**好主意**！"';
    const html = formatMessageWithStyles(text);
    console.log(html);
    // 输出：完整的 HTML，包含内联样式
}

/**
 * 示例 3: 自定义颜色
 */
function example3() {
    const text = '*内心独白* "对话内容"';
    const html = formatMessageWithStyles(text, {
        colors: {
            em: 'rgb(100, 100, 200)', // 蓝色
            quote: 'rgb(200, 100, 100)', // 红色
            underline: 'rgb(100, 200, 100)', // 绿色
        },
    });
    console.log(html);
}

/**
 * 示例 4: 只生成 CSS
 */
function example4() {
    const css = getStylesheet();
    console.log(css);
    // 可以将这个 CSS 添加到你的网页中
}

/**
 * 示例 5: 修复格式问题
 */
function example5() {
    // 注意：星号周围有多余的空格
    const badText = '( * 思考着 * ) " 说话 "';
    const fixedText = fixMarkdown(badText, true);
    console.log(fixedText);
    // 输出：( *思考着* ) " 说话 "

    const html = formatMessage(fixedText);
    console.log(html);
    // 输出：( <em>思考着</em> ) <q>" 说话 "</q>
}

/**
 * 示例 6: 处理不配对的标记
 */
function example6() {
    const text = '这行有奇数个星号*';
    const fixed = fixMarkdown(text, true);
    console.log(fixed);
    // 输出：这行有奇数个星号**
}

// 取消注释以运行示例
// example1();
// example2();
// example3();
// example4();
// example5();
// example6();
