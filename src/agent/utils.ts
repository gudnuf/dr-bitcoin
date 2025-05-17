import readline from "readline";

/**
 * Prompts the user with a question and returns their response
 */
export async function promptUser(
	rl: readline.Interface,
	prompt: string,
): Promise<string> {
	return new Promise<string>((resolve) => {
		rl.question(prompt, (answer) => {
			resolve(answer);
		});
	});
}
