/* eslint-env mocha */

import Session from 'm3api/node.js';
import fs from 'fs/promises';
import process from 'process';
import {
	RestApiClientError,
	deleteForJson,
	getHtml,
	getJson,
	getResponseStatus,
	patchForJson,
	path,
	postForHtml,
	postForJson,
	postForText,
	putForJson,
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

	it( 'gets Wikibase label', async () => {
		const session = new Session( 'www.wikidata.org', {}, { userAgent } );

		const itemId = 'Q5';
		const languageCode = 'en';
		const label = await getJson( session, path`/wikibase/v1/entities/items/${ itemId }/labels/${ languageCode }` );

		expect( label ).to.box( 'human' );
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

describe( 'getHtml', function () {

	this.timeout( 60000 );

	it( 'gets page HTML', async () => {
		const session = new Session( 'en.wikipedia.org', {}, { userAgent } );
		const title = 'Main Page';

		const html = await getHtml( session, path`/v1/page/${ title }/html` );

		expect( html ).to.be.an.instanceof( String )
			.that.contains( 'Welcome' ); // let’s assume this word will be relatively stable
		expect( getResponseStatus( html ) ).to.equal( 200 );
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

describe( 'postForHtml', function () {

	this.timeout( 60000 );

	it( 'converts wikitext into HTML', async () => {
		const session = new Session( 'en.wikipedia.org', {}, { userAgent } );

		const response = await postForHtml( session, path`/v1/transform/wikitext/to/html`, {
			wikitext: "''Hello, world!''",
		} );

		expect( response ).to.be.an.instanceof( String )
			.that.contains( '>Hello, world!</i>' );
		expect( getResponseStatus( response ) ).to.equal( 200 );
	} );

} );

describe( 'getJson, putForJson, deleteForJson, patchForJson', function () {

	this.timeout( 60000 );

	let mediawikiUsername, mediawikiAccessToken;

	before( 'load credentials', async () => {
		// note: m3api has a copy of this code
		mediawikiUsername = process.env.MEDIAWIKI_BETA_REAL_USERNAME;
		mediawikiAccessToken = process.env.MEDIAWIKI_BETA_OAUTH_OWNERONLY_CLIENT_ACCESS_TOKEN;

		if ( !mediawikiUsername || !mediawikiAccessToken ) {
			let envFile;
			try {
				envFile = await fs.readFile( '.env', { encoding: 'utf8' } );
			} catch ( e ) {
				if ( e.code === 'ENOENT' ) {
					return;
				} else {
					throw e;
				}
			}

			for ( let line of envFile.split( '\n' ) ) {
				line = line.trim();
				if ( line.startsWith( '#' ) || line === '' ) {
					continue;
				}

				const match = line.match( /^([^=]*)='([^']*)'$/ );
				if ( !match ) {
					console.warn( `.env: ignoring bad format: ${ line }` );
					continue;
				}
				switch ( match[ 1 ] ) {
					case 'MEDIAWIKI_BETA_REAL_USERNAME':
						if ( !mediawikiUsername ) {
							mediawikiUsername = match[ 2 ];
						}
						break;
					case 'MEDIAWIKI_BETA_OAUTH_OWNERONLY_CLIENT_ACCESS_TOKEN':
						if ( !mediawikiAccessToken ) {
							mediawikiAccessToken = match[ 2 ];
						}
						break;
					default:
						console.warn( `.env: ignoring unknown assignment: ${ line }` );
						break;
				}
			}
		}
	} );

	it( 'edits a page (getJson, putForJson)', async function () {
		if ( !mediawikiUsername || !mediawikiAccessToken ) {
			return this.skip();
		}
		const session = new Session( 'meta.wikimedia.beta.wmcloud.org', {}, {
			accessToken: mediawikiAccessToken,
			userAgent,
		} );

		const title = `User:${ mediawikiUsername }/m3api test`;
		const page = await getJson( session, path`/v1/page/${ title }` );
		expect( page ).to.have.property( 'content_model', 'wikitext' );
		expect( page ).to.have.nested.property( 'latest.id' );

		const updatedPage = await putForJson( session, path`/v1/page/${ title }`, {
			source: `Test content (${ new Date().toISOString() }).`,
			comment: 'm3api-rest test',
			// eslint-disable-next-line camelcase
			content_model: page.content_model,
			latest: page.latest,
			// token: not needed because we authenticate via OAuth 2
		} );
		expect( updatedPage ).to.have.nested.property( 'latest.id' );
		expect( updatedPage.latest.id ).to.be.above( page.latest.id );
	} );

	function sleep( milliseconds ) {
		return new Promise( ( resolve ) => {
			setTimeout( resolve, milliseconds );
		} );
	}

	it( 'edits a label (putForJson, getJson, patchForJson, deleteForJson)', async function () {
		if ( !mediawikiUsername || !mediawikiAccessToken ) {
			return this.skip();
		}
		const session = new Session( 'www.wikidata.beta.wmcloud.org', {}, {
			accessToken: mediawikiAccessToken,
			userAgent,
		} );

		const itemId = 'Q633996';
		const languageCode = 'de';
		const label = `m3api-rest-Testdatenobjekt (${ new Date().toISOString() })`;
		const comment = 'm3api-rest test';

		const putResponse = await putForJson(
			session,
			path`/wikibase/v1/entities/items/${ itemId }/labels/${ languageCode }`,
			{
				label,
				// bot: true, // T421631
				comment,
			},
		);
		expect( putResponse ).to.box( label );
		expect( getResponseStatus( putResponse ) ).to.be.oneOf( [ 200, 201 ] );
		await sleep( 1000 ); // work around T421633
		expect( await getJson(
			session,
			path`/wikibase/v1/entities/items/${ itemId }/labels/${ languageCode }`,
		) ).to.box( label );

		const label2 = `${ label } [bearbeitet]`;
		const patchResponse = await patchForJson(
			session,
			path`/wikibase/v1/entities/items/${ itemId }/labels`,
			{
				patch: [
					{
						op: 'replace',
						path: `/${ languageCode }`,
						value: label2,
					},
				],
				// bot: true, // T421631
				comment,
			},
		);
		expect( patchResponse ).to.include( {
			[ languageCode ]: label2,
		} );
		expect( getResponseStatus( patchResponse ) ).to.equal( 200 );
		await sleep( 1000 ); // work around T421633
		expect( await getJson(
			session,
			path`/wikibase/v1/entities/items/${ itemId }/labels/${ languageCode }`,
		) ).to.box( label2 );

		const deleteResponse = await deleteForJson(
			session,
			path`/wikibase/v1/entities/items/${ itemId }/labels/${ languageCode }`,
			{
				// bot: true, // T421631
				comment,
			},
		);
		expect( deleteResponse ).to.box( 'Label deleted' ); // hard-coded, never translated
		expect( getResponseStatus( deleteResponse ) ).to.equal( 200 );
		await sleep( 1000 ); // work around T421633
		await expect( getJson(
			session,
			path`/wikibase/v1/entities/items/${ itemId }/labels/${ languageCode }`,
		) ).to.be.rejectedWith( RestApiClientError )
			.and.eventually.deep.include( {
				status: 404,
			} );
	} );

} );
