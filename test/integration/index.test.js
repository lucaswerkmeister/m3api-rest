/* eslint-env mocha */

import Session from 'm3api/node.js';
import {
	RestApiClientError,
	getJson,
	getResponseStatus,
	path,
	postForJson,
} from '../../index.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use( chaiAsPromised );

const userAgent = 'm3api-rest-integration-tests (https://phabricator.wikimedia.org/tag/m3api/)';

describe( 'getJson', function () {

	this.timeout( 60000 );

	it( 'gets bare page information', async () => {
		const session = new Session( 'en.wikipedia.org', {}, { userAgent } );

		const title = 'Main Page';
		const page = await getJson( session, path`/v1/page/${ title }/bare` );

		// given WP:DDMP, I think it’s reasonable to consider the main page’s ID stable
		expect( page.id ).to.equal( 15580374 );
		expect( page.content_model ).to.equal( 'wikitext' );
		expect( getResponseStatus( page ) ).to.equal( 200 );
	} );

	it( 'gets search results', async () => {
		const session = new Session( 'en.wikipedia.org', {}, { userAgent } );

		const params = { q: 'test', limit: 1 };
		const search = await getJson( session, path`/v1/search/page?${ params }` );

		expect( search ).to.have.property( 'pages' )
			.to.have.length( 1 );
	} );

	it( 'throws RestApiClientError for missing page', async () => {
		const session = new Session( 'en.wikipedia.org', {}, { userAgent } );

		// creation-protected since 2014; used as the example on WP:RED
		const title = 'Red link example';
		// an alternative would be an invalid title like '['

		await expect( getJson( session, path`/v1/page/${ title }/bare` ) )
			.to.be.rejectedWith( RestApiClientError )
			.and.eventually.include( { status: 404 } );
	} );

} );

describe( 'postForJson', function () {

	this.timeout( 60000 );

	it( 'converts HTML into wikitext', async () => {
		const session = new Session( 'en.wikipedia.org', {}, { userAgent } );

		const response = await postForJson( session, path`/v1/transform/wikitext/to/lint`, new URLSearchParams( {
			wikitext: '',
		} ) );

		expect( response ).to.eql( [] );
		expect( getResponseStatus( response ) ).to.eql( 200 );
	} );

} );
