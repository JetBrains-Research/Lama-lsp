import { EarlyExitException, IRecognitionException, MismatchedTokenException } from 'chevrotain';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { ITokentoVSRange } from './go-to-definition';

export function handleParseErrors(exceptions: IRecognitionException[]):Diagnostic[] {
	let problems: Diagnostic[] = [];
	exceptions.forEach(e => {
		if(e.name == 'NoViableAltException') {
			problems.push({
				severity: DiagnosticSeverity.Error,
				range: {
					start: ITokentoVSRange(e.token).start,
					end: e.resyncedTokens.length > 0 ? ITokentoVSRange(e.resyncedTokens[e.resyncedTokens.length - 1]).end : ITokentoVSRange(e.token).end
				},
				message: handleMessage(e)
			})
		}
		else if (e.name == 'NotAllInputParsedException') {
			problems.push({
				severity: DiagnosticSeverity.Error,
				range: {
					start: ITokentoVSRange(e.token).start,
					end: e.resyncedTokens.length > 0 ? ITokentoVSRange(e.resyncedTokens[e.resyncedTokens.length - 1]).end : ITokentoVSRange(e.token).end
				},
				message: e.message
			})
		}
		else if(e.name == 'MismatchedTokenException') {
			problems.push({
				severity: DiagnosticSeverity.Error,
				range: {
					start: ITokentoVSRange((e as MismatchedTokenException).previousToken).end,
					end: ITokentoVSRange((e as MismatchedTokenException).previousToken).end
				},
				message: e.message
			})
		}
		else if(e.name == 'EarlyExitException') {
			problems.push({
				severity: DiagnosticSeverity.Error,
				range: {
					start: ITokentoVSRange((e as EarlyExitException).previousToken).end,
					end: ITokentoVSRange((e as EarlyExitException).token).end
				},
				message: handleMessage(e)
			})
		}
	})
	return problems;
}

function handleMessage(e: IRecognitionException): string {
	if(e.name == 'NoViableAltException') {
		return `Parse error: ${e.name}. Was expected: ${e.context.ruleStack[e.context.ruleStack.length - 1]}`;
	}
	else if(e.name == 'EarlyExitException') {
		return `Parse error: ${e.name}. Was expected at least one: ${e.context.ruleStack[e.context.ruleStack.length - 1]}, but found: '${e.token.image}'`;
	}
	else return '';
}