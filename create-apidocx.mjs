
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectDir = path.join(__dirname, 'apidocx');

function writeFile(relativePath, content) {
    const filePath = path.join(projectDir, relativePath);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');

    console.log(`created ${relativePath}`);
}

function removeProject() {
    if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, {
            recursive: true,
            force: true
        });
    }
}

removeProject();

fs.mkdirSync(projectDir, { recursive: true });

writeFile(
    'package.json',
    `{
  "name": "apidocx",
  "version": "0.1.0",
  "description": "Versioned API documentation generator",
  "type": "module",
  "bin": {
    "apidocx": "./bin/apidocx.js"
  },
  "files": [
    "bin",
    "src"
  ],
  "scripts": {
    "start": "node bin/apidocx.js",
    "build": "node bin/apidocx.js build",
    "init": "node bin/apidocx.js init",
    "check": "node bin/apidocx.js check"
  },
  "keywords": [
    "api",
    "documentation",
    "jsdoc",
    "apidoc",
    "cli"
  ],
  "license": "MIT"
}
`
);

writeFile(
    'version.md',
    `0.1.0
`
);

writeFile(
    'apidocx.config.js',
    `export default {
    project: 'APIDocX',

    source: {
        include: [
            '**/*.js',
            '**/*.ts'
        ],

        exclude: [
            'node_modules/**',
            'dist/**',
            'build/**',
            'docs/**'
        ]
    },

    output: {
        directory: './docs'
    },

    version: {
        file: './version.md'
    },

    documentation: {
        language: 'en'
    }
};
`
);

writeFile(
    'bin/apidocx.js',
    `#!/usr/bin/env node

import { run } from '../src/cli.js';

run(process.argv.slice(2)).catch(error => {
    console.error('');
    console.error('[APIDocX] Error:');
    console.error(error?.stack || error?.message || error);
    process.exit(1);
});
`
);

writeFile(
    'src/config.js',
    `import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_CONFIG = {
    project: 'API Documentation',

    source: {
        include: [
            '**/*.js'
        ],

        exclude: [
            'node_modules/**',
            'dist/**',
            'build/**',
            'docs/**'
        ]
    },

    output: {
        directory: './docs'
    },

    version: {
        file: './version.md'
    },

    documentation: {
        language: 'en'
    }
};

export async function loadConfig(root = process.cwd()) {
    const configFile = path.join(root, 'apidocx.config.js');

    if (!fs.existsSync(configFile)) {
        return resolveConfig(DEFAULT_CONFIG, root);
    }

    const module = await import(
        pathToFileURL(configFile).href
    );

    return resolveConfig(
        {
            ...DEFAULT_CONFIG,
            ...(module.default || {})
        },
        root
    );
}

export function resolveConfig(config, root) {
    return {
        ...config,

        root,

        source: {
            ...DEFAULT_CONFIG.source,
            ...(config.source || {})
        },

        output: {
            ...DEFAULT_CONFIG.output,
            ...(config.output || {})
        },

        version: {
            ...DEFAULT_CONFIG.version,
            ...(config.version || {})
        },

        documentation: {
            ...DEFAULT_CONFIG.documentation,
            ...(config.documentation || {})
        }
    };
}
`
);

writeFile(
    'src/version.js',
    `import fs from 'node:fs';
import path from 'node:path';

export function readVersion(root, versionFile = './version.md') {
    const filePath = path.resolve(root, versionFile);

    if (!fs.existsSync(filePath)) {
        throw new Error(
            \`Version file not found: \${filePath}\`
        );
    }

    const content = fs.readFileSync(
        filePath,
        'utf8'
    ).trim();

    const match = content.match(
        /(?:^|\\\\n)\\\\s*(\\\\d+\\\\.\\\\d+\\\\.\\\\d+)(?:[-+][0-9A-Za-z.-]+)?\\\\s*(?:$|\\\\n)/
    );

    if (!match) {
        throw new Error(
            \`Could not find semantic version in \${filePath}\`
        );
    }

    return match[1];
}
`
);

writeFile(
    'src/scanner.js',
    String.raw`
import fs from 'node:fs';
import path from 'node:path';

function normalize(value) {
    return value
        .replace(/\\/g, '/')
        .replace(/^\.\/+/, '');
}

function matches(pattern, value) {
    pattern = normalize(pattern);
    value = normalize(value);

    let regex = '';

    for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i];

        if (char === '*') {
            if (pattern[i + 1] === '*') {
                regex += '.*';
                i++;
            } else {
                regex += '[^/]*';
            }

            continue;
        }

        if (char === '?') {
            regex += '.';
            continue;
        }

        if ('\\\\.^$+{}()[]|'.includes(char)) {
            regex += '\\\\' + char;
            continue;
        }

        regex += char;
    }

    return new RegExp(
        '^' + regex + '$'
    ).test(value);
}

function walk(directory, root, result = []) {
    if (!fs.existsSync(directory)) {
        return result;
    }

    for (const entry of fs.readdirSync(
        directory,
        { withFileTypes: true }
    )) {
        if (
            entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'docs'
        ) {
            continue;
        }

        const fullPath = path.join(
            directory,
            entry.name
        );

        if (entry.isDirectory()) {
            walk(
                fullPath,
                root,
                result
            );

            continue;
        }

        result.push(
            normalize(
                path.relative(
                    root,
                    fullPath
                )
            )
        );
    }

    return result;
}

export function scan(root, config) {
    const allFiles = walk(
        root,
        root
    );

    const includes =
        config.source.include ||
        ['**/*.js'];

    const excludes =
        config.source.exclude ||
        [];

    return allFiles.filter(file => {
        const included =
            includes.some(
                pattern =>
                    matches(pattern, file)
            );

        if (!included) {
            return false;
        }

        const excluded =
            excludes.some(
                pattern =>
                    matches(pattern, file)
            );

        return !excluded;
    });
}
`
);

writeFile(
    'src/parser.js',
    String.raw`
function cleanComment(raw) {
    return raw
        .replace(/^\/\*\*/, '')
        .replace(/\*\/$/, '')
        .split('\n')
        .map(line =>
            line
                .replace(/^\s*\*\s?/, '')
                .trimEnd()
        )
        .join('\n')
        .trim();
}

function parseTags(content) {
    const lines = content.split('\n');

    const tags = [];
    let current = null;

    for (const line of lines) {
        const match = line.match(
            /^@([A-Za-z][A-Za-z0-9_-]*)(?:\s+(.*))?$/
        );

        if (match) {
            current = {
                tag: match[1],
                value: match[2] || '',
                lines: []
            };

            tags.push(current);
            continue;
        }

        if (current) {
            current.lines.push(line);
        }
    }

    return tags.map(tag => ({
        tag: tag.tag,
        value: [
            tag.value,
            ...tag.lines
        ]
            .join('\n')
            .trim()
    }));
}

function getTag(tags, name) {
    return tags.find(
        tag => tag.tag === name
    );
}

function getTags(tags, name) {
    return tags.filter(
        tag => tag.tag === name
    );
}

function parseParam(value) {
    const match = value.match(
        /^\{([^}]+)\}\s+(\S+)(?:\s+([\s\S]*))?$/
    );

    if (!match) {
        return {
            type: '',
            name: value.trim(),
            description: ''
        };
    }

    return {
        type: match[1],
        name: match[2],
        description: match[3] || ''
    };
}

function findDeclaration(source, position) {
    const after = source.slice(position);

    const match = after.match(
        /^\s*(?:export\s+)?(?:default\s+)?(class|function)\s+([A-Za-z_$][\w$]*)/
    );

    if (!match) {
        return {};
    }

    return {
        kind: match[1],
        name: match[2]
    };
}

function parseComment(source, commentStart, commentEnd, comment) {
    const content = cleanComment(comment);
    const tags = parseTags(content);

    const apiTag = getTag(tags, 'api');
    const methodTag = getTag(tags, 'method');

    if (!apiTag && !methodTag) {
        return null;
    }

    const declaration = findDeclaration(
        source,
        commentEnd
    );

    const descriptionTag = getTag(
        tags,
        'description'
    );

    const groupTag = getTag(
        tags,
        'group'
    );

    const publicTag = getTag(
        tags,
        'public'
    );

    const privateTag = getTag(
        tags,
        'private'
    );

    const params = getTags(
        tags,
        'param'
    ).map(tag =>
        parseParam(tag.value)
    );

    const examples = getTags(
        tags,
        'example'
    ).map(tag => tag.value);

    const returnsTag = getTag(
        tags,
        'returns'
    );

    const result = {
        api: apiTag?.value || undefined,
        method: methodTag?.value || undefined,

        name:
            methodTag?.value ||
            apiTag?.value ||
            declaration.name,

        group: groupTag?.value || 'API',

        description:
            descriptionTag?.value || '',

        params,

        returns:
            returnsTag?.value || '',

        examples,

        public: Boolean(publicTag),
        private: Boolean(privateTag),

        kind: declaration.kind,

        sourceStart: commentStart,
        sourceEnd: commentEnd
    };

    if (!result.api && result.method) {
        result.api = declaration.name;
    }

    return result;
}

export function parseSource(source, file = '') {
    const result = [];

    const commentRegex = /\/\*\*[\s\S]*?\*\//g;

    let match;

    while ((match = commentRegex.exec(source))) {
        const commentStart = match.index;
        const commentEnd =
            match.index + match[0].length;

        const parsed = parseComment(
            source,
            commentStart,
            commentEnd,
            match[0]
        );

        if (!parsed) {
            continue;
        }

        parsed.file = file;

        result.push(parsed);
    }

    return result;
}

export function parseFile(filePath) {
    const source = fs.readFileSync(
        filePath,
        'utf8'
    );

    return parseSource(
        source,
        filePath
    );
}
`
);

writeFile(
    'src/model.js',
    `export function createApiModel({
    project,
    version,
    entries
}) {
    const apis = entries
        .filter(entry => {
            if (entry.private) {
                return false;
            }

            return Boolean(
                entry.api ||
                entry.method
            );
        })
        .map(entry => ({
            ...entry
        }));

    return {
        project,
        version,
        generatedAt: new Date().toISOString(),
        apis
    };
}
`
);

writeFile(
    'src/renderer.js',
    String.raw`
function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function slugify(value = '') {
    return String(value)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeApiId(api, index) {
    if (api.id) {
        return api.id;
    }

    const base = api.method
        ? \`\${api.api || 'api'}-\${api.method}\`
        : api.api || api.name || \`api-\${index}\`;

    return slugify(base);
}

function getApiName(api) {
    return api.api || api.name || api.method || 'Unnamed API';
}

function getMethodName(api) {
    return api.method || api.name || 'method';
}

function getGroupName(api) {
    return api.group || 'API';
}

function isMethod(api) {
    return Boolean(api.method);
}

function buildNavigation(apis) {
    const groups = new Map();

    for (const [index, api] of apis.entries()) {
        const group = getGroupName(api);

        if (!groups.has(group)) {
            groups.set(group, []);
        }

        groups.get(group).push({
            api,
            index,
            id: normalizeApiId(api, index)
        });
    }

    return [...groups.entries()]
        .map(([group, items]) => {
            const parents = [];
            const methods = [];

            for (const item of items) {
                if (isMethod(item.api)) {
                    methods.push(item);
                } else {
                    parents.push(item);
                }
            }

            return {
                group,
                parents,
                methods
            };
        });
}

function renderSidebar(apis) {
    const groups = buildNavigation(apis);

    return groups.map(({ group, parents, methods }) => {
        const parentMap = new Map();

        for (const item of parents) {
            parentMap.set(getApiName(item.api), {
                ...item,
                methods: []
            });
        }

        for (const item of methods) {
            const parentName =
                item.api.parent ||
                item.api.api;

            if (parentMap.has(parentName)) {
                parentMap
                    .get(parentName)
                    .methods
                    .push(item);
            }
        }

        const standaloneMethods = methods.filter(item => {
            const parentName =
                item.api.parent ||
                item.api.api;

            return !parentMap.has(parentName);
        });

        return \`
            <section class="nav-group">
                <div class="nav-group-title">
                    \${escapeHtml(group)}
                </div>

                <div class="nav-group-items">
                    \${[...parentMap.values()]
                        .map(renderNavParent)
                        .join('')}

                    \${standaloneMethods
                        .map(renderNavMethod)
                        .join('')}

                    \${
                        parents.length === 0 &&
                        methods.length === 0
                            ? '<div class="nav-empty">No API entries</div>'
                            : ''
                    }
                </div>
            </section>
        \`;
    }).join('');
}

function renderNavParent(item) {
    const name = getApiName(item.api);
    const id = item.id;

    return \`
        <div class="nav-parent">
            <button
                class="nav-item nav-parent-button"
                type="button"
                data-target="\${escapeHtml(id)}"
            >
                <span class="nav-icon">◆</span>
                <span>\${escapeHtml(name)}</span>
            </button>

            \${
                item.methods.length
                    ? \`
                        <div class="nav-methods">
                            \${item.methods
                                .map(renderNavMethod)
                                .join('')}
                        </div>
                    \`
                    : ''
            }
        </div>
    \`;
}

function renderNavMethod(item) {
    const api = item.api;
    const id = item.id;

    return \`
        <button
            class="nav-item nav-method"
            type="button"
            data-target="\${escapeHtml(id)}"
        >
            <span class="nav-method-line"></span>
            <span>\${escapeHtml(getMethodName(api))}()</span>
        </button>
    \`;
}

function renderParams(params = []) {
    if (!params.length) {
        return '';
    }

    return \`
        <section class="detail-section">
            <h3>Parameters</h3>

            <div class="table-wrapper">
                <table class="params-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Description</th>
                        </tr>
                    </thead>

                    <tbody>
                        \${params.map(param => \`
                            <tr>
                                <td>
                                    <code>\${escapeHtml(param.name || '')}</code>
                                </td>

                                <td>
                                    <code>\${escapeHtml(param.type || '')}</code>
                                </td>

                                <td>
                                    \${escapeHtml(param.description || '')}
                                </td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    \`;
}

function renderReturns(returns) {
    if (!returns) {
        return '';
    }

    let type = '';
    let description = '';

    if (typeof returns === 'string') {
        const match = returns.match(
            /^\{([^}]+)\}\s*(.*)$/
        );

        if (match) {
            type = match[1];
            description = match[2];
        } else {
            description = returns;
        }
    } else if (typeof returns === 'object') {
        type = returns.type || '';
        description = returns.description || '';
    }

    return \`
        <section class="detail-section">
            <h3>Returns</h3>

            <div class="returns">
                \${
                    type
                        ? \`<code>\${escapeHtml(type)}</code>\`
                        : ''
                }

                \${
                    description
                        ? \`<span>\${escapeHtml(description)}</span>\`
                        : ''
                }
            </div>
        </section>
    \`;
}

function renderExamples(examples = []) {
    if (!examples.length) {
        return '';
    }

    return \`
        <section class="detail-section">
            <h3>Examples</h3>

            \${examples.map(example => \`
                <pre class="code-block"><code>\${escapeHtml(example)}</code></pre>
            \`).join('')}
        </section>
    \`;
}

function renderDetail(api, index) {
    const id = normalizeApiId(api, index);
    const method = isMethod(api);

    const title = method
        ? getMethodName(api)
        : getApiName(api);

    const signature = method
        ? \`\${getMethodName(api)}(\${(api.params || [])
            .map(param => param.name)
            .join(', ')})\`
        : getApiName(api);

    return \`
        <article
            class="api-detail"
            id="\${escapeHtml(id)}"
            data-detail="\${escapeHtml(id)}"
        >
            <header class="detail-header">
                <div class="detail-breadcrumb">
                    \${escapeHtml(getGroupName(api))}
                    <span>/</span>
                    \${escapeHtml(
                        method
                            ? getApiName(api)
                            : title
                    )}
                </div>

                <div class="detail-title-row">
                    <h1>\${escapeHtml(title)}</h1>

                    \${
                        api.public
                            ? '<span class="badge badge-public">public</span>'
                            : ''
                    }
                </div>

                <div class="signature">
                    <code>\${escapeHtml(signature)}</code>
                </div>
            </header>

            \${
                api.description
                    ? \`
                        <section class="detail-section description">
                            <h3>Description</h3>
                            <p>\${escapeHtml(api.description)}</p>
                        </section>
                    \`
                    : ''
            }

            \${renderParams(api.params)}

            \${renderReturns(api.returns)}

            \${renderExamples(api.examples)}

            \${
                !api.description &&
                !(api.params || []).length &&
                !api.returns &&
                !(api.examples || []).length
                    ? \`
                        <div class="empty-detail">
                            No additional documentation available.
                        </div>
                    \`
                    : ''
            }
        </article>
    \`;
}

function renderSearch() {
    return \`
        <div class="search">
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <circle cx="11" cy="11" r="7"></circle>
                <path d="m20 20-3.5-3.5"></path>
            </svg>

            <input
                id="api-search"
                type="search"
                placeholder="Search API..."
                autocomplete="off"
            />
        </div>
    \`;
}

function renderHtml(model) {
    const project =
        model.project ||
        'API Documentation';

    const version =
        model.version ||
        '0.0.0';

    const apis =
        Array.isArray(model.apis)
            ? model.apis
            : [];

    const sidebar = renderSidebar(apis);

    const details = apis
        .map((api, index) =>
            renderDetail(api, index)
        )
        .join('');

    return \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>\${escapeHtml(project)} — API</title>

    <style>
        :root {
            --bg: #0b0d10;
            --sidebar: #101318;
            --panel: #12161c;
            --panel-hover: #181d25;
            --border: #252b34;
            --text: #e8eaed;
            --text-muted: #969da8;
            --text-soft: #c2c7cf;
            --accent: #7aa2f7;
            --accent-soft: rgba(122, 162, 247, 0.12);
            --code-bg: #0a0c0f;
            --radius: 10px;
        }

        * {
            box-sizing: border-box;
        }

        html {
            scroll-behavior: smooth;
        }

        body {
            margin: 0;

            background: var(--bg);
            color: var(--text);

            font-family:
                Inter,
                ui-sans-serif,
                system-ui,
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                sans-serif;

            line-height: 1.6;
        }

        button,
        input {
            font: inherit;
        }

        button {
            color: inherit;
        }

        .app {
            min-height: 100vh;
            display: flex;
        }

        .sidebar {
            width: 300px;
            min-width: 300px;

            height: 100vh;
            position: sticky;
            top: 0;

            overflow-y: auto;

            background: var(--sidebar);
            border-right: 1px solid var(--border);

            padding: 22px 16px;
        }

        .brand {
            padding: 4px 10px 20px;
        }

        .brand-name {
            font-size: 18px;
            font-weight: 700;
            letter-spacing: -0.02em;
        }

        .brand-meta {
            margin-top: 3px;

            color: var(--text-muted);
            font-size: 12px;
        }

        .search {
            height: 38px;

            display: flex;
            align-items: center;
            gap: 9px;

            padding: 0 11px;
            margin: 0 0 22px;

            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 8px;

            color: var(--text-muted);
        }

        .search:focus-within {
            border-color: var(--accent);
        }

        .search input {
            width: 100%;

            border: 0;
            outline: 0;

            background: transparent;
            color: var(--text);

            font-size: 13px;
        }

        .search input::placeholder {
            color: #68707c;
        }

        .nav-group {
            margin-bottom: 24px;
        }

        .nav-group-title {
            padding: 0 10px 7px;

            color: #6f7783;

            font-size: 11px;
            font-weight: 700;

            letter-spacing: 0.12em;
            text-transform: uppercase;
        }

        .nav-group-items {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .nav-item {
            width: 100%;

            display: flex;
            align-items: center;

            border: 0;
            background: transparent;

            cursor: pointer;
            text-align: left;

            transition:
                background 0.12s ease,
                color 0.12s ease;
        }

        .nav-parent-button {
            min-height: 36px;

            gap: 9px;

            padding: 7px 10px;

            border-radius: 7px;

            color: var(--text-soft);

            font-size: 14px;
            font-weight: 600;
        }

        .nav-parent-button:hover {
            background: var(--panel-hover);
            color: var(--text);
        }

        .nav-parent-button.active {
            background: var(--accent-soft);
            color: var(--accent);
        }

        .nav-icon {
            width: 14px;

            color: #6d7682;
            font-size: 8px;
        }

        .nav-methods {
            margin: 1px 0 5px 17px;

            border-left: 1px solid var(--border);
        }

        .nav-method {
            position: relative;

            min-height: 30px;

            padding: 5px 8px 5px 14px;

            color: var(--text-muted);

            font-family:
                ui-monospace,
                SFMono-Regular,
                Menlo,
                Monaco,
                Consolas,
                monospace;

            font-size: 12px;
            border-radius: 5px;
        }

        .nav-method:hover {
            background: var(--panel-hover);
            color: var(--text);
        }

        .nav-method.active {
            background: var(--accent-soft);
            color: var(--accent);
        }

        .nav-method-line {
            width: 4px;
            height: 4px;

            margin-right: 8px;

            background: currentColor;
            border-radius: 50%;

            opacity: 0.6;
        }

        .nav-empty {
            padding: 8px 10px;

            color: var(--text-muted);
            font-size: 12px;
        }

        .main {
            flex: 1;
            min-width: 0;

            padding: 48px 64px;
        }

        .content {
            width: 100%;
            max-width: 1000px;

            margin: 0 auto;
        }

        .welcome {
            min-height: 60vh;

            display: flex;
            flex-direction: column;
            justify-content: center;

            color: var(--text-soft);
        }

        .welcome h1 {
            margin: 0 0 10px;

            color: var(--text);

            font-size: 34px;
            line-height: 1.2;

            letter-spacing: -0.03em;
        }

        .welcome p {
            max-width: 680px;

            margin: 0;

            color: var(--text-muted);
        }

        .api-detail {
            display: none;

            animation: detail-in 0.16s ease;
        }

        .api-detail.active {
            display: block;
        }

        @keyframes detail-in {
            from {
                opacity: 0;
                transform: translateY(4px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .detail-header {
            padding-bottom: 28px;

            border-bottom: 1px solid var(--border);
        }

        .detail-breadcrumb {
            display: flex;
            gap: 8px;

            margin-bottom: 12px;

            color: var(--text-muted);
            font-size: 12px;
        }

        .detail-breadcrumb span {
            color: #555d68;
        }

        .detail-title-row {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .detail-title-row h1 {
            margin: 0;

            font-size: 32px;
            line-height: 1.2;

            letter-spacing: -0.03em;
        }

        .badge {
            padding: 3px 7px;

            border-radius: 5px;

            font-size: 10px;
            font-weight: 700;

            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        .badge-public {
            background: rgba(90, 200, 120, 0.12);
            color: #79d69a;
        }

        .signature {
            margin-top: 16px;
        }

        .signature code {
            display: inline-block;

            padding: 8px 11px;

            background: var(--code-bg);
            border: 1px solid var(--border);

            border-radius: 6px;

            color: #c9d1d9;

            font-family:
                ui-monospace,
                SFMono-Regular,
                Menlo,
                Monaco,
                Consolas,
                monospace;

            font-size: 13px;
        }

        .detail-section {
            padding: 28px 0;

            border-bottom: 1px solid var(--border);
        }

        .detail-section h3 {
            margin: 0 0 13px;

            color: var(--text);

            font-size: 14px;
            font-weight: 700;
        }

        .description p {
            max-width: 800px;

            margin: 0;

            color: var(--text-soft);

            font-size: 15px;
            line-height: 1.75;
        }

        .table-wrapper {
            overflow-x: auto;

            border: 1px solid var(--border);
            border-radius: var(--radius);
        }

        .params-table {
            width: 100%;
            border-collapse: collapse;

            font-size: 13px;
        }

        .params-table th {
            padding: 10px 13px;

            background: var(--panel);

            color: var(--text-muted);

            text-align: left;

            font-size: 11px;
            font-weight: 700;

            text-transform: uppercase;
            letter-spacing: 0.06em;
        }

        .params-table td {
            padding: 12px 13px;

            border-top: 1px solid var(--border);

            color: var(--text-soft);

            vertical-align: top;
        }

        .params-table code,
        .returns code {
            color: #c9d1d9;

            font-family:
                ui-monospace,
                SFMono-Regular,
                Menlo,
                Monaco,
                Consolas,
                monospace;

            font-size: 12px;
        }

        .returns {
            display: flex;
            align-items: center;
            gap: 12px;

            color: var(--text-soft);
        }

        .returns code {
            padding: 4px 7px;

            background: var(--code-bg);
            border: 1px solid var(--border);

            border-radius: 5px;
        }

        .code-block {
            margin: 0 0 12px;
            padding: 16px;

            overflow-x: auto;

            background: var(--code-bg);
            border: 1px solid var(--border);

            border-radius: var(--radius);

            color: #c9d1d9;

            font-family:
                ui-monospace,
                SFMono-Regular,
                Menlo,
                Monaco,
                Consolas,
                monospace;

            font-size: 13px;
            line-height: 1.7;
        }

        .code-block:last-child {
            margin-bottom: 0;
        }

        .empty-detail {
            padding: 35px 0;

            color: var(--text-muted);
            font-size: 14px;
        }

        @media (max-width: 900px) {
            .sidebar {
                width: 250px;
                min-width: 250px;
            }

            .main {
                padding: 35px 30px;
            }
        }

        @media (max-width: 700px) {
            .app {
                display: block;
            }

            .sidebar {
                width: 100%;
                min-width: 0;

                height: auto;
                position: relative;

                border-right: 0;
                border-bottom: 1px solid var(--border);

                padding: 15px;
            }

            .nav-group {
                margin-bottom: 16px;
            }

            .main {
                padding: 30px 18px;
            }

            .detail-title-row h1 {
                font-size: 26px;
            }

            .welcome {
                min-height: 40vh;
            }
        }
    </style>
</head>

<body>
    <div class="app">

        <aside class="sidebar">
            <div class="brand">
                <div class="brand-name">
                    \${escapeHtml(project)}
                </div>

                <div class="brand-meta">
                    API Documentation · v\${escapeHtml(version)}
                </div>
            </div>

            \${renderSearch()}

            <nav id="api-navigation">
                \${sidebar}
            </nav>
        </aside>

        <main class="main">
            <div class="content">

                <section
                    id="welcome"
                    class="welcome"
                >
                    <h1>\${escapeHtml(project)}</h1>

                    <p>
                        Select an API entry from the navigation
                        to view its documentation.
                    </p>
                </section>

                \${details}

            </div>
        </main>

    </div>

    <script>
        (() => {
            const details = Array.from(
                document.querySelectorAll('[data-detail]')
            );

            const navItems = Array.from(
                document.querySelectorAll('[data-target]')
            );

            const welcome =
                document.getElementById('welcome');

            const search =
                document.getElementById('api-search');

            function getTargetId() {
                const hash = window.location.hash;

                if (!hash) {
                    return null;
                }

                return decodeURIComponent(
                    hash.slice(1)
                );
            }

            function findDetail(id) {
                if (!id) {
                    return null;
                }

                return details.find(
                    detail =>
                        detail.dataset.detail === id
                );
            }

            function setActiveNav(id) {
                navItems.forEach(item => {
                    item.classList.toggle(
                        'active',
                        item.dataset.target === id
                    );
                });
            }

            function showDetail(
                id,
                updateHash = true
            ) {
                const detail = findDetail(id);

                if (!detail) {
                    showWelcome();
                    return false;
                }

                details.forEach(item => {
                    item.classList.remove('active');
                });

                detail.classList.add('active');

                setActiveNav(id);

                welcome.style.display = 'none';

                if (updateHash) {
                    history.replaceState(
                        null,
                        '',
                        '#' +
                        encodeURIComponent(id)
                    );
                }

                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });

                return true;
            }

            function showWelcome() {
                details.forEach(item => {
                    item.classList.remove('active');
                });

                navItems.forEach(item => {
                    item.classList.remove('active');
                });

                welcome.style.display = 'flex';
            }

            function openInitial() {
                const hashId = getTargetId();

                if (
                    hashId &&
                    showDetail(hashId, false)
                ) {
                    return;
                }

                const firstNav = navItems[0];

                if (firstNav) {
                    showDetail(
                        firstNav.dataset.target,
                        false
                    );
                } else {
                    showWelcome();
                }
            }

            navItems.forEach(item => {
                item.addEventListener(
                    'click',
                    () => {
                        showDetail(
                            item.dataset.target,
                            true
                        );
                    }
                );
            });

            window.addEventListener(
                'hashchange',
                () => {
                    const id = getTargetId();

                    if (id) {
                        showDetail(id, false);
                    }
                }
            );

            if (search) {
                search.addEventListener(
                    'input',
                    () => {
                        const query =
                            search.value
                                .trim()
                                .toLowerCase();

                        document
                            .querySelectorAll(
                                '.nav-item'
                            )
                            .forEach(item => {
                                const text =
                                    item.textContent
                                        .trim()
                                        .toLowerCase();

                                const match =
                                    !query ||
                                    text.includes(query);

                                item.style.display =
                                    match
                                        ? ''
                                        : 'none';
                            });
                    }
                );
            }

            openInitial();
        })();
    </script>
</body>
</html>\`;
}

export function render(model) {
    return renderHtml(model);
}

export default render;
`
);

writeFile(
    'src/cli.js',
    `import fs from 'node:fs';
import path from 'node:path';

import { loadConfig } from './config.js';
import { readVersion } from './version.js';
import { scan } from './scanner.js';
import { parseFile } from './parser.js';
import { createApiModel } from './model.js';
import render from './renderer.js';

function printHelp() {
    console.log(\`
APIDocX

Versioned API documentation generator.

Usage:

  apidocx
  apidocx build
  apidocx init
  apidocx check
  apidocx --version
  apidocx --help

Commands:

  build     Scan sources and generate documentation
  init      Create apidocx.config.js
  check     Validate documented API
\`);
}

function printVersion() {
    const packagePath = new URL(
        '../package.json',
        import.meta.url
    );

    const packageData =
        JSON.parse(
            fs.readFileSync(
                packagePath,
                'utf8'
            )
        );

    console.log(
        \`APIDocX v\${packageData.version}\`
    );
}

export async function init(root) {
    const configPath =
        path.join(
            root,
            'apidocx.config.js'
        );

    if (fs.existsSync(configPath)) {
        console.log(
            'apidocx.config.js already exists.'
        );

        return;
    }

    fs.writeFileSync(
        configPath,
        \`export default {
    project: 'My Project',

    source: {
        include: ['**/*.js'],
        exclude: [
            'node_modules/**',
            'dist/**',
            'build/**',
            'docs/**'
        ]
    },

    output: {
        directory: './docs'
    },

    version: {
        file: './version.md'
    },

    documentation: {
        language: 'en'
    }
};
\`,
        'utf8'
    );

    console.log(
        'Created apidocx.config.js'
    );
}

export async function build(root) {
    const config =
        await loadConfig(root);

    const version =
        readVersion(
            root,
            config.version.file
        );

    const files =
        scan(root, config);

    console.log(
        \`[APIDocX] Scanning \${files.length} files...\`
    );

    const entries = [];

    for (const relativeFile of files) {
        const absoluteFile =
            path.join(
                root,
                relativeFile
            );

        try {
            const parsed =
                parseFile(absoluteFile);

            entries.push(...parsed);
        } catch (error) {
            console.warn(
                \`[APIDocX] Failed to parse \${relativeFile}\`
            );

            console.warn(
                error.message
            );
        }
    }

    const model =
        createApiModel({
            project:
                config.project ||
                path.basename(root),

            version,

            entries
        });

    const outputDirectory =
        path.resolve(
            root,
            config.output.directory
        );

    const versionDirectory =
        path.join(
            outputDirectory,
            'versions',
            version
        );

    fs.mkdirSync(
        versionDirectory,
        { recursive: true }
    );

    const apiJson =
        JSON.stringify(
            model,
            null,
            2
        );

    const html =
        render(model);

    fs.writeFileSync(
        path.join(
            outputDirectory,
            'api.json'
        ),
        apiJson,
        'utf8'
    );

    fs.writeFileSync(
        path.join(
            outputDirectory,
            'index.html'
        ),
        html,
        'utf8'
    );

    fs.writeFileSync(
        path.join(
            versionDirectory,
            'api.json'
        ),
        apiJson,
        'utf8'
    );

    fs.writeFileSync(
        path.join(
            versionDirectory,
            'index.html'
        ),
        html,
        'utf8'
    );

    console.log('');
    console.log(
        \`[APIDocX] Project: \${model.project}\`
    );

    console.log(
        \`[APIDocX] Version: \${version}\`
    );

    console.log(
        \`[APIDocX] API entries: \${model.apis.length}\`
    );

    console.log(
        \`[APIDocX] Output: \${outputDirectory}\`
    );

    console.log('');
    console.log(
        '[APIDocX] Documentation generated successfully.'
    );
}

export async function check(root) {
    const config =
        await loadConfig(root);

    const version =
        readVersion(
            root,
            config.version.file
        );

    const files =
        scan(root, config);

    const entries = [];

    for (const relativeFile of files) {
        const absoluteFile =
            path.join(
                root,
                relativeFile
            );

        try {
            entries.push(
                ...parseFile(absoluteFile)
            );
        } catch {
            // Ignore files that cannot be parsed.
        }
    }

    const publicEntries =
        entries.filter(
            entry =>
                entry.public &&
                !entry.private
        );

    const documented =
        entries.filter(
            entry =>
                entry.api ||
                entry.method
        );

    console.log(
        \`[APIDocX] Version: \${version}\`
    );

    console.log(
        \`[APIDocX] Source files: \${files.length}\`
    );

    console.log(
        \`[APIDocX] Documented entries: \${documented.length}\`
    );

    console.log(
        \`[APIDocX] Public entries: \${publicEntries.length}\`
    );

    console.log('');
    console.log(
        '[APIDocX] Check completed.'
    );
}

export async function run(args = []) {
    const root =
        process.cwd();

    const command =
        args[0] || 'build';

    switch (command) {
        case 'build':
            await build(root);
            break;

        case 'init':
            await init(root);
            break;

        case 'check':
            await check(root);
            break;

        case '--version':
        case '-v':
            printVersion();
            break;

        case '--help':
        case '-h':
        case 'help':
            printHelp();
            break;

        default:
            console.error(
                \`Unknown command: \${command}\`
            );

            console.error(
                'Use "apidocx --help" for help.'
            );

            process.exitCode = 1;
    }
}
`
);

writeFile(
    'README.md',
    `# APIDocX

Versioned API documentation generator.

## Install

\`\`\`bash
npm install
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`

or:

\`\`\`bash
node bin/apidocx.js
\`\`\`

## Output

\`\`\`
docs/
├── index.html
├── api.json
└── versions/
    └── 0.1.0/
        ├── index.html
        └── api.json
\`\`\`

## Documentation syntax

\`\`\`js
/**
 * @api PluginManager
 * @group Plugins
 * @description
 * Manages plugins.
 * @public
 */
export class PluginManager {

    /**
     * @method use
     * @description
     * Installs a plugin.
     * @param {Plugin} plugin Plugin to install.
     * @returns {PluginManager}
     * @example
     * const plugins = new PluginManager(...);
     * plugins.use(StatePlugin);
     * @public
     */
    use(plugin) {}
}
\`\`\`

## CLI

\`\`\`bash
npx apidocx
npx apidocx build
npx apidocx init
npx apidocx check
npx apidocx --version
\`\`\`
`
);

console.log('');
console.log('======================================');
console.log(' APIDocX project created');
console.log('======================================');
console.log('');
console.log(`Location: ${projectDir}`);
console.log('');
console.log('Next:');
console.log('');
console.log(`  cd ${path.basename(projectDir)}`);
console.log('  npm run build');
console.log('');
console.log('Then open:');
console.log('');
console.log(`  ${path.join(projectDir, 'docs', 'index.html')}`);
console.log('');

