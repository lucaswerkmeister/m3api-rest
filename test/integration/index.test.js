/* eslint-env mocha */

import Session from 'm3api/node.js';
import {
	RestApiClientError,
	getJson,
	getResponseStatus,
	path,
	postForJson,
	postForText,
} from '../../index.js';
import chaiBox from '../helper/box.js';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use( chaiAsPromised );
use( chaiBox );

const userAgent = 'm3api-rest-integration-tests (https://phabricator.wikimedia.org/tag/m3api/)';

describe( 'getJson', function () {

	this.timeout( 60000 );

	describe( 'gets bare page information', () => {

		for ( const [ name, pageGetter ] of [
			[ 'via params in path``', ( session, title ) => getJson( session, path`/v1/page/${ title }/bare` ) ],
			[ 'via separate params', ( session, title ) => getJson( session, '/v1/page/{title}/bare', { title } ) ],
		] ) {
			it( name, async () => {
				const session = new Session( 'en.wikipedia.org', {}, { userAgent } );
				const title = 'Main Page';

				const page = await pageGetter( session, title );

				// given WP:DDMP, I think it’s reasonable to consider the main page’s ID stable
				expect( page.id ).to.equal( 15580374 );
				expect( page.content_model ).to.equal( 'wikitext' );
				expect( getResponseStatus( page ) ).to.equal( 200 );
			} );
		}

	} );

	describe( 'gets search results', () => {

		for ( const [ name, searchGetter ] of [
			[ 'via params in path``', ( session, params ) => getJson( session, path`/v1/search/page?${ params }` ) ],
			[ 'via separate params', ( session, params ) => getJson( session, '/v1/search/page', params ) ],
		] ) {
			it( name, async () => {
				const session = new Session( 'en.wikipedia.org', {}, { userAgent } );
				const params = { q: 'test', limit: 1 };

				const search = await searchGetter( session, params );

				expect( search ).to.have.property( 'pages' )
					.to.have.length( 1 );
			} );
		}

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

	for ( const [ bodyType, body ] of [
		[ 'JSON object', { wikitext: '' } ],
		[ 'URLSearchParams', new URLSearchParams( { wikitext: '' } ) ],
		[ 'FormData', ( () => {
			const body = new FormData();
			body.set( 'wikitext', '' );
			return body;
		} )() ],
	] ) {
		it( `converts wikitext into lints (${ bodyType } body)`, async () => {
			const session = new Session( 'en.wikipedia.org', {}, { userAgent } );

			const response = await postForJson( session, path`/v1/transform/wikitext/to/lint`, body );

			expect( response ).to.eql( [] );
			expect( getResponseStatus( response ) ).to.equal( 200 );
		} );
	}

} );

describe( 'postForText', function () {

	this.timeout( 60000 );

	for ( const [ bodyType, body ] of [
		[ 'JSON object', { html: '<i>Hello, world!</i>' } ],
		[ 'URLSearchParams', new URLSearchParams( { html: '<i>Hello, world!</i>' } ) ],
		[ 'FormData', ( () => {
			const body = new FormData();
			body.set( 'html', '<i>Hello, world!</i>' );
			return body;
		} )() ],
	] ) {
		it( `converts HTML into wikitext (${ bodyType } body)`, async () => {
			const session = new Session( 'en.wikipedia.org', {}, { userAgent } );

			const response = await postForText( session, path`/v1/transform/html/to/wikitext`, body );

			expect( response ).to.box( "''Hello, world!''" );
			expect( getResponseStatus( response ) ).to.equal( 200 );
		} );
	}

} );
