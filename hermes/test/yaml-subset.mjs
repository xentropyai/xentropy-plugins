// Strict parser for the YAML subset our Hermes files use (the repo has no dependencies).
// Supported: block mappings, empty [] and {}, block sequences of scalars or mappings, `|` and `>-` block scalars,
// plain/single/double-quoted scalars, integers, booleans, null, full-line and trailing comments.
// Anything else (flow collections, anchors, tags, multi-documents) throws, so a file that parses here
// is also plain YAML. The tests cross-check the result against PyYAML's safe_load when python3 has it.

const fail = (n, msg) => {
  throw new Error(`yaml line ${n + 1}: ${msg}`);
};

function stripComment(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "#" && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i).trimEnd();
  }
  return text.trimEnd();
}

function scalar(raw, n) {
  const v = raw.trim();
  if (v === "" || v === "~" || v === "null") return null;
  if (v === "[]") return [];
  if (v === "{}") return {};
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (v.startsWith('"')) {
    if (!/^"(?:[^"\\]|\\.)*"$/.test(v)) fail(n, "bad double-quoted scalar");
    return JSON.parse(v);
  }
  if (v.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(v)) fail(n, "bad single-quoted scalar");
    return v.slice(1, -1).replace(/''/g, "'");
  }
  if (/^[[{&*!|>%@`]/.test(v)) fail(n, `unsupported YAML construct: ${v}`);
  if (/: |\s#/.test(v)) fail(n, `ambiguous plain scalar: ${v}`);
  return v;
}

export function parseYaml(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines.some((l) => /^(---|\.\.\.)\s*$/.test(l))) fail(0, "multi-document YAML is not supported");
  let i = 0;
  const indentOf = (l) => l.match(/^ */)[0].length;
  const blank = (l) => l.trim() === "" || l.trim().startsWith("#");
  const skip = () => {
    while (i < lines.length && blank(lines[i])) i++;
  };

  function blockScalar(style, parentIndent) {
    const body = [];
    let indent = null;
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() === "") {
        body.push("");
        i++;
        continue;
      }
      const ind = indentOf(l);
      if (ind <= parentIndent) break;
      indent ??= ind;
      if (ind < indent) fail(i, "block scalar indentation decreased");
      body.push(l.slice(indent));
      i++;
    }
    while (body.length && body[body.length - 1] === "") body.pop();
    if (style === "|") return body.join("\n") + "\n";
    if (style === ">-") return body.join("\n").replace(/([^\n])\n(?=[^\n])/g, "$1 ").replace(/\n\n/g, "\n");
    fail(i, `unsupported block scalar style ${style}`);
  }

  function value(rest, n, indent) {
    const v = stripComment(rest).trim();
    if (v === "|" || v === ">-") return blockScalar(v, indent);
    if (v === "") {
      skip();
      if (i >= lines.length || indentOf(lines[i]) <= indent) {
        // a key with an empty value, or a sequence at the same indent as its key
        if (i < lines.length && indentOf(lines[i]) === indent && lines[i].trim().startsWith("- ")) return node(indent);
        return null;
      }
      return node(indentOf(lines[i]));
    }
    return scalar(v, n);
  }

  function node(indent) {
    skip();
    if (i >= lines.length) return null;
    return lines[i].trim().startsWith("- ") || lines[i].trim() === "-" ? sequence(indent) : mapping(indent);
  }

  function mapping(indent) {
    const out = {};
    while (true) {
      skip();
      if (i >= lines.length) break;
      const l = lines[i];
      const ind = indentOf(l);
      if (ind < indent) break;
      if (ind > indent) fail(i, "unexpected indentation");
      const m = l.slice(ind).match(/^([A-Za-z_$][A-Za-z0-9_$.-]*):(?:\s+(.*)|\s*)$/);
      if (!m) fail(i, `expected "key: value", got: ${l.trim()}`);
      if (Object.hasOwn(out, m[1])) fail(i, `duplicate key ${m[1]}`);
      const n = i++;
      out[m[1]] = value(m[2] ?? "", n, indent);
    }
    return out;
  }

  function sequence(indent) {
    const out = [];
    while (true) {
      skip();
      if (i >= lines.length) break;
      const l = lines[i];
      const ind = indentOf(l);
      if (ind < indent || !l.trim().startsWith("-")) break;
      if (ind > indent) fail(i, "unexpected indentation in sequence");
      const rest = l.slice(ind + 1);
      const item = stripComment(rest).trim();
      if (/^[A-Za-z_$][A-Za-z0-9_$.-]*:(\s|$)/.test(item)) {
        // a mapping item: re-read this line as a mapping indented past the dash
        const inner = ind + 1 + rest.match(/^ */)[0].length;
        lines[i] = " ".repeat(inner) + rest.trimStart();
        out.push(mapping(inner));
      } else {
        const n = i++;
        out.push(value(rest, n, indent));
      }
    }
    return out;
  }

  const result = node(0);
  skip();
  if (i < lines.length) fail(i, "trailing content");
  return result;
}
