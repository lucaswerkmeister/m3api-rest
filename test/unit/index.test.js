/* eslint-env mocha */

import {
	todo,
} from '../../index.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use( chaiAsPromised );

describe( 'todo', () => {

	it( 'returns its argument', () => {
		const v = 123;
		expect( todo( v ) ).to.equal( v );
	} );

} );
