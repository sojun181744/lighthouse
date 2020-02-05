/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const CharsetDefinedAudit = require('../../../audits/dobetterweb/charset.js');
const assert = require('assert');
const networkRecordsToDevtoolsLog = require('../../network-records-to-devtools-log.js');

/* eslint-env jest */

const HTML_PRE = '<!doctype html><head>';
const HTML_POST = '</head><body><h1>hello';

function generateArtifacts(htmlContent, contentTypeValue = 'text/html') {
  const finalUrl = 'https://example.com/';
  const mainResource = {
    url: finalUrl,
    responseHeaders: [
      {name: 'content-type', value: contentTypeValue},
    ],
  };
  const devtoolsLog = networkRecordsToDevtoolsLog([mainResource]);
  const context = {computedCache: new Map()};
  return [{
    devtoolsLogs: {[CharsetDefinedAudit.DEFAULT_PASS]: devtoolsLog},
    URL: {finalUrl},
    MainDocumentContent: htmlContent,
  }, context];
}

describe('Charset defined audit', () => {
  it('succeeds where the page contains the charset meta tag', async () => {
    const htmlContent = HTML_PRE + '<meta charset="utf-8" >' + HTML_POST;
    const [artifacts, context] = generateArtifacts(htmlContent);
    const auditResult = await CharsetDefinedAudit.audit(artifacts, context);
    assert.equal(auditResult.score, 1);
  });

  it('succeeds when the page has the charset defined in the content-type meta tag', async () => {
    const htmlContent = HTML_PRE +
      '<meta http-equiv="Content-type" content="text/html; charset=utf-8" />' + HTML_POST;
    const [artifacts, context] = generateArtifacts(htmlContent);
    const auditResult = await CharsetDefinedAudit.audit(artifacts, context);
    assert.equal(auditResult.score, 1);
  });

  it('succeeds when the page has the charset defined in the content-type http header', async () => {
    const htmlContent = HTML_PRE +
      '<meta http-equiv="Content-type" content="text/html" />' + HTML_POST;
    const contentTypeVal = 'text/html; charset=UTF-8';
    const [artifacts, context] = generateArtifacts(htmlContent, contentTypeVal);
    const auditResult = await CharsetDefinedAudit.audit(artifacts, context);
    assert.equal(auditResult.score, 1);
  });

  it('succeeds when the page has the charset defined via BOM', async () => {
    const htmlContent = '\ufeff' + HTML_PRE +
      '<meta http-equiv="Content-type" content="text/html" />' + HTML_POST;
    const [artifacts, context] = generateArtifacts(htmlContent);
    const auditResult = await CharsetDefinedAudit.audit(artifacts, context);
    assert.equal(auditResult.score, 1);
  });

  it('fails when the page does not have charset defined', async () => {
    const htmlContent = HTML_PRE + '<meta http-equiv="Content-type" content="text/html" />';
    const [artifacts, context] = generateArtifacts(htmlContent);
    const auditResult = await CharsetDefinedAudit.audit(artifacts, context);
    assert.equal(auditResult.score, 0);
  });

  it('fails when the page has charset defined too late in the page', async () => {
    const bigString = new Array(1024).fill(' ').join('');
    const htmlContent = HTML_PRE + bigString + '<meta charset="utf-8" />' + HTML_POST;
    const [artifacts, context] = generateArtifacts(htmlContent);
    const auditResult = await CharsetDefinedAudit.audit(artifacts, context);
    assert.equal(auditResult.score, 0);
  });

  it('passes when the page has charset defined almost too late in the page', async () => {
    const bigString = new Array(900).fill(' ').join('');
    const htmlContent = HTML_PRE + bigString + '<meta charset="utf-8" />' + HTML_POST;
    const [artifacts, context] = generateArtifacts(htmlContent);
    const auditResult = await CharsetDefinedAudit.audit(artifacts, context);
    assert.equal(auditResult.score, 1);
  });

  it('fails when charset only partially defined in the first 1024 bytes of the page', async () => {
    const charsetHTML = '<meta charset="utf-8" />';
    // 1024 bytes should be halfway through the meta tag
    const bigString = new Array(1024 - HTML_PRE.length - charsetHTML.length / 2).fill(' ').join('');
    const htmlContent = HTML_PRE + bigString + charsetHTML + HTML_POST;
    const [artifacts, context] = generateArtifacts(htmlContent);
    const auditResult = await CharsetDefinedAudit.audit(artifacts, context);
    assert.equal(auditResult.score, 0);
  });
});

describe('Charset regex check', () => {
  const HTML_REGEX = CharsetDefinedAudit.CHARSET_HTML_REGEX;

  it('handles html correctly', () => {
    assert.equal(HTML_REGEX.test('<meta charset=utf-8 />'), true);
    assert.equal(HTML_REGEX.test(`<!doctype html><meta charset=utf-8 /><body>`), true);
    assert.equal(HTML_REGEX.test(`<!doctype html><meta charset= /><body>`), false);
    assert.equal(HTML_REGEX.test(`<!doctype html><meta description=hello><body>`), false);
    assert.equal(HTML_REGEX.test(`<!doctype html><meta   charset=utf-8  /><body>`), true);
    assert.equal(HTML_REGEX.test(`<!doctype html><meta charset=utf-8><body>`), true);
    assert.equal(HTML_REGEX.test(`<!doctype html><meta charset=UTF-8><body>`), true);
    assert.equal(HTML_REGEX.test(`<!doctype html><meta charset=""/><body>`), false);
    assert.equal(HTML_REGEX.test(
      `<!doctype html><meta http-equiv="Content-type" content="text/html; charset=utf-8"/><body>'`),
      true);
    assert.equal(HTML_REGEX.test(
      `<!doctype html><meta http-equiv="Content-type" content="text/html; nope-tf8" /><body>'`),
      false);
    assert.equal(HTML_REGEX.test(
      `<!doctype html><meta http-equiv="Content-type" content="text/html; charset=utf-8" <body>'`),
      false);
    assert.equal(HTML_REGEX.test(
      `<!doctype html><meta content="text/html; charset=utf-8" http-equiv="Content-type"/><body>'`),
      true);
  });

  it('handles http header correctly', () => {
    assert.equal(CharsetDefinedAudit.CHARSET_HTTP_REGEX.test('text/html; charset=UTF-8'), true);
    assert.equal(CharsetDefinedAudit.CHARSET_HTTP_REGEX.test('text/html; charset='), false);
    assert.equal(CharsetDefinedAudit.CHARSET_HTTP_REGEX.test('text/html; charset = UTF-8'), true);
    assert.equal(CharsetDefinedAudit.CHARSET_HTTP_REGEX.test('text/html; charset=x'), false);
    assert.equal(CharsetDefinedAudit.CHARSET_HTTP_REGEX.test('text/html; charset=  '), false);
  });
});
