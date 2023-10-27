import { LamaParser } from './parser';

export function formatTextDocument(text: string) {
	const parser = new LamaParser;
	const tokens = parser.lex(text);
	const formattedTokens = tokens.map(token => token.image);
    const formattedText = formattedTokens.join('\n');
	return [formattedText];
 }