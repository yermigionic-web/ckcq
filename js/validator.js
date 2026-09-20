const SEPARATORS = /[\s,./·•|\\_-–—~]+/g;

function asString(value) {
  if (value == null) return "";
  return String(value);
}

export function normalizeAnswer(input) {
  let s = asString(input).normalize("NFKC");
  s = s.replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ");
  s = s.replace(/[,，、]/g, ",");
  s = s.replace(/\s*,\s*/g, ", ");
  s = s.replace(/\s+/g, " ");
  s = s.trim().toLowerCase();
  return s;
}

export function compactAnswer(input) {
  return normalizeAnswer(input).replace(SEPARATORS, "");
}

export function tokenizeAnswer(input) {
  return normalizeAnswer(input)
    .replace(/[/·•|\\_~]+/g, " ")
    .replace(/[-–—]+/g, " ")
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function matchesAccepted(input, acceptedAnswers = []) {
  const normalized = normalizeAnswer(input);
  const compact = compactAnswer(input);
  if (!normalized) return false;

  return acceptedAnswers.some((answer) => {
    const acceptedNorm = normalizeAnswer(answer);
    const acceptedCompact = compactAnswer(answer);
    return normalized === acceptedNorm || compact === acceptedCompact;
  });
}

function termFound(compactInput, term) {
  const needle = compactAnswer(term);
  return Boolean(needle) && compactInput.includes(needle);
}

function matchesAnyOrder(input, groups) {
  if (!Array.isArray(groups) || groups.length === 0) return false;
  const compact = compactAnswer(input);
  return groups.every((group) =>
    (group || []).some((term) => termFound(compact, term))
  );
}

function tokensMatchTerm(tokens, start, term) {
  const termTokens = tokenizeAnswer(term);
  if (!termTokens.length || start + termTokens.length > tokens.length) return 0;
  const slice = tokens.slice(start, start + termTokens.length);
  const ok = slice.every(
    (token, index) => compactAnswer(token) === compactAnswer(termTokens[index])
  );
  return ok ? termTokens.length : 0;
}

function matchesOrdered(input, groups) {
  if (!Array.isArray(groups) || groups.length === 0) return false;
  const tokens = tokenizeAnswer(input);
  let cursor = 0;

  for (const group of groups) {
    if (cursor >= tokens.length) return false;
    const aliases = [...(group || [])].sort(
      (a, b) => tokenizeAnswer(b).length - tokenizeAnswer(a).length
    );
    let consumed = 0;
    for (const term of aliases) {
      consumed = tokensMatchTerm(tokens, cursor, term);
      if (consumed) break;
    }
    if (!consumed) return false;
    cursor += consumed;
  }

  return cursor === tokens.length;
}

function splitSequence(answer) {
  return tokenizeAnswer(answer);
}

export function deriveOrderedGroups(question) {
  if (Array.isArray(question.requiredTerms) && question.requiredTerms.length) {
    return question.requiredTerms;
  }

  const sequences = (question.acceptedAnswers || [])
    .map(splitSequence)
    .filter((seq) => seq.length);

  if (!sequences.length) return [];

  const length = sequences[0].length;
  if (!sequences.every((seq) => seq.length === length)) {
    return sequences[0].map((term) => [term]);
  }

  return Array.from({ length }, (_, index) => {
    const aliases = [];
    for (const seq of sequences) {
      if (!aliases.includes(seq[index])) aliases.push(seq[index]);
    }
    return aliases;
  });
}

export function validateAnswer(question, input) {
  if (!question) return false;
  const trimmed = asString(input).trim();
  if (!trimmed) return false;

  if (matchesAccepted(input, question.acceptedAnswers)) return true;

  const type = question.validationType || "single";

  if (type === "allRequiredAnyOrder") {
    return matchesAnyOrder(input, question.requiredTerms);
  }

  if (type === "allRequiredOrdered") {
    return matchesOrdered(input, deriveOrderedGroups(question));
  }

  return false;
}
