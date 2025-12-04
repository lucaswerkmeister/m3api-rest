/**
 * Encode a path for a REST API endpoint.
 *
 * This function should be used as a tag for a tagged template literal (template string).
 * Usage example:
 * ```
 * const title = 'AC/DC';
 * console.log( path`/page/${ title }` );
 * // logs /page/AC%2FDC
 * ```
 *
 * (Calling this function like a regular function is not very useful,
 * so you can ignore the parameters documented below.)
 *
 * @param {string[]} strings
 * @param {Array} values
 * @return {string}
 */
export function path( strings, ...values ) {
	return String.raw( { raw: strings }, ...values.map( encodeURIComponent ) );
}
