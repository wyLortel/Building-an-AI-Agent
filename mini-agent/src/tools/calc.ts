export function calculate(expression: string): number {
    const tokens = expression.match(/\d+\.?\d*|[+\-*/()]/g);
    if (!tokens) throw new Error("빈 수식");
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];

    function parseExpr(): number {
        let v = parseTerm();
        while (peek() === "+" || peek() === "-") {
            const op = next();
            const r = parseTerm();
            v = op === "+" ? v + r : v - r;
        }
        return v;
    }

    function parseTerm(): number {
        let v = parseFactor();
        while (peek() === "*" || peek() === "/") {
            const op = next();
            const r = parseFactor();
            if (op === "/" && r === 0) throw new Error("0으로 나눌 수 없습니다");
            v = op === "*" ? v * r : v / r;
        }
        return v;
    }

    function parseFactor(): number {
        if (peek() === "(") {
            next();
            const v = parseExpr();
            if (next() !== ")") throw new Error("괄호가 맞지 않습니다");
            return v;
        }
        const t = next();
        const n = Number(t);
        if (Number.isNaN(n)) throw new Error(`예상치 못한 토큰: ${t}`);
        return n;
    }

    const result = parseExpr();
    if (pos !== tokens.length) throw new Error("수식 파싱 실패");
    return result;
}