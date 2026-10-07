// Shared bits for the tests: a pass/fail counter.
export function createChecker() {
	let failures = 0
	const check = (name, cond, detail = '') => {
		if (cond) console.log(`  PASS  ${name}`)
		else {
			failures++
			console.log(`  FAIL  ${name} ${detail}`)
		}
	}
	const finish = () => {
		if (failures > 0) {
			console.log(`  ${failures} check(s) failed`)
			process.exit(1)
		}
		process.exit(0)
	}
	return { check, finish }
}
