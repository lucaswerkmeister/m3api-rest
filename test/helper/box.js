/* eslint-disable no-underscore-dangle */
import { expect } from 'chai';

// eslint-disable-next-line jsdoc/require-param -- not useful to document, function is not called directly
/**
 * Adds a `.box()` assertion method to Chai,
 * which is called with a primitive string, number or boolean
 * and asserts that the value is a boxed String, Number or Boolean
 * wrapping the same value.
 *
 * ```
 * expect( new String( 'hi' ) ).to.box( 'hi' );
 * ```
 *
 * If the assertion is negated, the value is expected not to be equal,
 * but it is still expected to be an instance of the right boxed type.
 *
 * ```
 * expect( new String( 'foo' ) ).not.to.box( 'bar' ); // passes
 * expect( 'foo' ).not.to.box( 'bar' ); // fails, 'foo' is not boxed
 * ```
 *
 * Installation: `use( chaiBox )` or `chai.use( chaiBox )`,
 * depending on how you imported Chai.
 */
export default function chaiBox( chai, utils ) {
	const {
		Assertion,
	} = chai;
	const {
		transferFlags,
	} = utils;

	Assertion.addMethod( 'box', function ( unboxed ) {
		switch ( typeof unboxed ) {
			case 'string':
				new Assertion( this._obj ).to.be.an.instanceof( String );
				break;
			case 'number':
				new Assertion( this._obj ).to.be.an.instanceof( Number );
				break;
			case 'boolean':
				new Assertion( this._obj ).to.be.an.instanceof( Boolean );
				break;
			default:
				expect.fail( 'box() must be called with a string, number, or boolean' );
		}
		const assertValueOf = new Assertion( this._obj.valueOf() );
		transferFlags( this, assertValueOf, false );
		assertValueOf.to.equal( unboxed );
	} );
}
