/**
 * The definitions of an area if it is active, otherwise the same ids without a definition.
 *
 * Companion's definition maps need every id of the schema; an id without a definition is simply not
 * offered. This keeps the type of the merged map exact while leaving out what the device cannot do now.
 */
export function onlyIf<T extends object>(active: boolean, definitions: T): { [K in keyof T]: T[K] | undefined } {
	if (active) return definitions
	return Object.fromEntries(Object.keys(definitions).map((id) => [id, undefined])) as {
		[K in keyof T]: undefined
	}
}
