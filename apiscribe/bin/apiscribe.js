#!/usr/bin/env node
'use strict';

const { generate, init } = require('../src');

const HELP = `apiscribe — генератор документации API из комментариев с @api-тегами

Использование:
  apiscribe [generate] [опции]   собрать документацию (по умолчанию)
  apiscribe init                 создать version.md и apiscribe.config.json

Опции:
  --src <папка>            где искать исходники            (по умолчанию .)
  --out <папка>            куда писать index.html          (docs/api)
  --version-file <файл>    файл с версией                  (version.md)
  --history <файл>         файл истории                    (<out>/history.json)
  --title <текст>          заголовок документации
  --lang ru|en             язык интерфейса                 (ru)
  --exclude a,b            дополнительные исключения
  --config <файл>          файл настроек                   (apiscribe.config.json)
  --force                  пересобрать HTML, даже если ничего не изменилось
  -q, --quiet              не печатать отчёт
  -h, --help               помощь
`;

const KEYS = {
  src: 'src',
  out: 'out',
  'version-file': 'versionFile',
  history: 'historyFile',
  title: 'title',
  lang: 'lang',
  config: 'config',
  exclude: 'exclude',
};

function parseArgs(argv) {
  const o = {};
  let cmd = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') o.help = true;
    else if (a === '-q' || a === '--quiet') o.quiet = true;
    else if (a === '--force') o.force = true;
    else if (a.startsWith('--')) {
      let [k, v] = a.slice(2).split(/=(.*)/s);
      if (v === undefined) v = argv[++i];
      if (!KEYS[k]) throw new Error(`Неизвестная опция --${k}`);
      if (v === undefined) throw new Error(`Для --${k} нужно значение`);
      o[KEYS[k]] = k === 'exclude' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v;
    } else if (!cmd) cmd = a;
    else throw new Error(`Лишний аргумент: ${a}`);
  }
  return { cmd: cmd || 'generate', opts: o };
}

function report(r) {
  const c = r.changes;
  const delta = c ? ` (+${c.added.length} ~${c.changed.length} −${c.removed.length} к ${r.previousVersion})` : '';
  const msg = {
    'new-version': `Версия ${r.version}: добавлена в историю${delta}`,
    updated: `Версия ${r.version}: API изменилось, запись обновлена${delta}`,
    unchanged: `Версия ${r.version}: без изменений`,
    locked: `Версия ${r.version} уже есть в истории и не последняя — старая запись не тронута. ` +
      `Поднимите версию в version.md, чтобы зафиксировать новые изменения.`,
  }[r.status];
  console.log(`${r.status === 'locked' ? '⚠' : '✔'} ${msg}`);
  console.log(`  эндпоинтов: ${r.endpointCount}, файлов просмотрено: ${r.filesScanned}`);
  console.log(`  документация: ${r.outFile}`);
  console.log(`  история:      ${r.historyFile}`);
  for (const w of r.warnings) console.warn(`  ! ${w}`);
}

try {
  const { cmd, opts } = parseArgs(process.argv.slice(2));
  if (opts.help || cmd === 'help') {
    console.log(HELP);
  } else if (cmd === 'init') {
    const created = init(opts);
    console.log(created.length ? `Создано: ${created.join(', ')}` : 'Всё уже на месте.');
    console.log('Добавьте в package.json: "scripts": { "docs": "apiscribe", "prestart": "apiscribe" }');
  } else if (cmd === 'generate') {
    const r = generate(opts);
    if (!opts.quiet) report(r);
  } else {
    throw new Error(`Неизвестная команда: ${cmd}`);
  }
} catch (e) {
  console.error('Ошибка: ' + e.message);
  process.exit(1);
}
