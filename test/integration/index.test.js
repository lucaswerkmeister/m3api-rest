/* eslint-env mocha */

import Session from 'm3api/node.js';
import {
	getJson,
	path,
} from '../../index.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use( chaiAsPromised );

const userAgent = 'm3api-rest-integration-tests (https://phabricator.wikimedia.org/tag/m3api/)';

describe( 'getJson', () => {

	it( 'gets bare page information', async () => {
		const session = new Session( 'en.wikipedia.org', {}, { userAgent } );

		const title = 'Main Page';
		const page = await getJson( session, path`/v1/page/${ title }/bare` );

		// given WP:DDMP, I think it’s reasonable to consider the main page’s ID stable
		expect( page.id ).to.equal( 15580374 );
		expect( page.content_model ).to.equal( 'wikitext' );
	} );

} );
