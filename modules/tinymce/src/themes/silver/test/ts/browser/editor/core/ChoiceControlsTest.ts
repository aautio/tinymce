import { UiFinder, Waiter } from '@ephox/agar';
import { beforeEach, context, describe, it } from '@ephox/bedrock-client';
import { Arr, Optional } from '@ephox/katamari';
import { TinyAssertions, TinyHooks, TinySelections, TinyUiActions } from '@ephox/mcagar';
import { Attribute } from '@ephox/sugar';
import { assert } from 'chai';

import Editor from 'tinymce/core/api/Editor';
import Theme from 'tinymce/themes/silver/Theme';

interface ToolbarOrMenuSpec {
  readonly name: string;
  readonly pOpen: (editor: Editor, title: string) => Promise<void>;
  readonly close: (editor: Editor, title: string) => void;
  readonly menuSelector: string;
}

describe('browser.tinymce.themes.silver.editor.core.ChoiceControlsTest', () => {

  const toolbarSpec: ToolbarOrMenuSpec = {
    name: 'Toolbar',
    pOpen: async (editor, title) => {
      TinyUiActions.clickOnToolbar(editor, `[title="${title}"]`);
      await TinyUiActions.pWaitForUi(editor, '[role="menu"]');
    },
    close: (editor, title) => TinyUiActions.clickOnToolbar(editor, `[title="${title}"]`),
    menuSelector: '[role="menu"]'
  };

  // This assumes that the menu item you're looking for is inside the "Format" menu
  const menuSpec: ToolbarOrMenuSpec = {
    name: 'Menu',
    pOpen: async (editor, title) => {
      TinyUiActions.clickOnMenu(editor, 'button:contains("Format")');
      await TinyUiActions.pWaitForUi(editor, '[role="menu"]');
      TinyUiActions.clickOnUi(editor, `[role="menu"] [title="${title}"]`);
    },
    close: (editor) => TinyUiActions.clickOnMenu(editor, 'button:contains("Format")'),
    menuSelector: '[role="menu"]~[role="menu"]' // the line-height submenu is always the *second* menu in the sink
  };

  const pSelectItem = async (editor: Editor, selector: string, value: string) => {
    await TinyUiActions.pWaitForUi(editor, selector);
    TinyUiActions.clickOnUi(editor, `[role="menuitemcheckbox"][title="${value}"]`);
  };

  const pAssertOptions = async (editor: Editor, selector: string, ideal: string[], current: Optional<string>) => {
    const menu = await TinyUiActions.pWaitForUi(editor, selector);
    // ensure that there aren't two checked options
    UiFinder.notExists(menu, '[aria-checked="true"]~[aria-checked="true"]');
    // ensure that the checked option (if it exists) lines up with what we expect
    current.fold(
      () => UiFinder.notExists(menu, '[aria-checked="true"]'),
      (current) => UiFinder.exists(menu, `[aria-checked="true"][title="${current}"]`)
    );
    // ensure that the list of options is correct
    const elements = UiFinder.findAllIn(menu, '[role="menuitemcheckbox"]');
    const actual = Arr.map(elements, (element) => Attribute.get(element, 'title'));
    assert.deepEqual(actual, ideal, 'Correct menu items are displayed');
  };

  context('Line height', () => {
    const baseSettings = {
      base_url: '/project/tinymce/js/tinymce',
      toolbar: 'lineheight'
    };

    context('Default settings', () => {
      const hook = TinyHooks.bddSetup<Editor>({
        ...baseSettings
      }, [ Theme ]);

      Arr.each([ menuSpec, toolbarSpec ], (spec) => {
        it(`TINY-4843: ${spec.name} lists correct line heights`, async () => {
          const editor = hook.editor();
          editor.setContent('<p style="line-height: 1.4;">Hello</p>');
          TinySelections.setCursor(editor, [ 0, 0 ], 0);
          await spec.pOpen(editor, 'Line height');
          await pAssertOptions(editor, spec.menuSelector, [ '1', '1.1', '1.2', '1.3', '1.4', '1.5', '2' ], Optional.some('1.4'));
          spec.close(editor, 'Line height');
        });

        it(`TINY-4843: ${spec.name} can alter line height`, async () => {
          const editor = hook.editor();
          editor.setContent('<p>Hello</p>');
          TinySelections.setCursor(editor, [ 0, 0 ], 0);
          await spec.pOpen(editor, 'Line height');
          await pSelectItem(editor, spec.menuSelector, '1.5');
          TinyAssertions.assertContent(editor, '<p style="line-height: 1.5;">Hello</p>');
        });

        it(`TINY-4843: ${spec.name} only shows values within settings`, async () => {
          const editor = hook.editor();
          editor.setContent('<p style="line-height: 30px;">Hello</p>');
          TinySelections.setCursor(editor, [ 0, 0 ], 0);
          await spec.pOpen(editor, 'Line height');
          await pAssertOptions(editor, spec.menuSelector, [ '1', '1.1', '1.2', '1.3', '1.4', '1.5', '2' ], Optional.none());
          spec.close(editor, 'Line height');
        });

        it(`TINY-4843: ${spec.name} updates if line height changes`, async () => {
          const editor = hook.editor();
          editor.setContent('<p style="line-height: 1.4;">Hello</p>');
          TinySelections.setCursor(editor, [ 0, 0 ], 0);
          await spec.pOpen(editor, 'Line height');
          await pAssertOptions(editor, spec.menuSelector, [ '1', '1.1', '1.2', '1.3', '1.4', '1.5', '2' ], Optional.some('1.4'));
          editor.execCommand('LineHeight', false, '1.1');
          await pAssertOptions(editor, spec.menuSelector, [ '1', '1.1', '1.2', '1.3', '1.4', '1.5', '2' ], Optional.some('1.1'));
          spec.close(editor, 'Line height');
        });
      });
    });

    context('Float line height detection', () => {
      const hook = TinyHooks.bddSetup<Editor>({
        ...baseSettings,
        lineheight_formats: '1 1.1 1.11 1.111'
      }, [ Theme ]);

      Arr.each([ menuSpec, toolbarSpec ], (spec) => {
        it(`TINY-4843: ${spec.name} lists specified line heights`, async () => {
          const editor = hook.editor();
          await spec.pOpen(editor, 'Line height');
          await pAssertOptions(editor, spec.menuSelector, [ '1', '1.1', '1.11', '1.111' ], Optional.none());
          spec.close(editor, 'Line height');
        });
      });
    });

    context('normalisation tests', () => {
      const hook = TinyHooks.bddSetup<Editor>({
        ...baseSettings,
        lineheight_formats: '1.000 20px 22.0px 1.5e2%'
      }, [ Theme ]);

      beforeEach(() => {
        hook.editor().setContent('');
      });

      Arr.each([ menuSpec, toolbarSpec ], (spec) => {
        it(`TINY-4843: ${spec.name} preserves original line height formats`, async () => {
          const editor = hook.editor();
          await spec.pOpen(editor, 'Line height');
          await pAssertOptions(editor, spec.menuSelector, [ '1.000', '20px', '22.0px', '1.5e2%' ], Optional.none());
          spec.close(editor, 'Line height');
        });

        it(`TINY-4843: ${spec.name} normalises line heights for comparison purposes`, async () => {
          const editor = hook.editor();
          editor.setContent('<p style="line-height: 150%">Hello</p>');
          TinySelections.setCursor(editor, [ 0, 0 ], 0);
          await spec.pOpen(editor, 'Line height');
          await pAssertOptions(editor, spec.menuSelector, [ '1.000', '20px', '22.0px', '1.5e2%' ], Optional.some('1.5e2%'));
          spec.close(editor, 'Line height');
        });
      });
    });
  });

  context('Content language', () => {
    const hook = TinyHooks.bddSetup<Editor>({
      base_url: '/project/tinymce/js/tinymce',
      toolbar: 'language',
      menu: {
        format: { title: 'Format', items: 'language' }
      }
    }, [ Theme ]);

    const defaultLanguages = [ 'English', 'Spanish', 'French', 'German', 'Portuguese', 'Chinese' ];

    context('Default settings', () => {
      Arr.each([ menuSpec, toolbarSpec ], (spec) => {
        it(`TINY-6149: ${spec.name} shows the correct default languages`, async () => {
          const editor = hook.editor();
          await spec.pOpen(editor, 'Language');
          await pAssertOptions(editor, spec.menuSelector, defaultLanguages, Optional.none());
          spec.close(editor, 'Language');
        });

        it(`TINY-6149: ${spec.name} shows the current language if it is in the settings`, async () => {
          const editor = hook.editor();
          editor.setContent('<p><span lang="en">Some content</span></p>');
          TinySelections.setCursor(editor, [ 0, 0, 0 ], 0);

          await spec.pOpen(editor, 'Language');
          await pAssertOptions(editor, spec.menuSelector, defaultLanguages, Optional.some('English'));
          spec.close(editor, 'Language');
        });

        it(`TINY-6149: ${spec.name} does not show the current language if it is not in the settings`, async () => {
          const editor = hook.editor();
          editor.setContent('<p><span lang="fake">Some content</span></p>');
          TinySelections.setCursor(editor, [ 0, 0, 0 ], 0);

          await spec.pOpen(editor, 'Language');
          await pAssertOptions(editor, spec.menuSelector, defaultLanguages, Optional.none());
          spec.close(editor, 'Language');
        });

        it(`TINY-6149: ${spec.name} updates the current language if the content changes`, async () => {
          const editor = hook.editor();
          editor.setContent('<p><span lang="en">Some content</span></p>');
          TinySelections.setCursor(editor, [ 0, 0, 0 ], 0);

          await spec.pOpen(editor, 'Language');
          await pAssertOptions(editor, spec.menuSelector, defaultLanguages, Optional.some('English'));

          editor.formatter.apply('lang', { value: 'zh' });

          await Waiter.pWait(0);
          await pAssertOptions(editor, spec.menuSelector, defaultLanguages, Optional.some('Chinese'));
          spec.close(editor, 'Language');
        });

        it(`TINY-6149: ${spec.name} can change the current lang tag`, async () => {
          const editor = hook.editor();
          editor.setContent('<p>Some content</p>');
          TinySelections.setSelection(editor, [ 0, 0 ], 0, [ 0, 0 ], 'Some content'.length);

          await spec.pOpen(editor, 'Language');
          await pSelectItem(editor, spec.menuSelector, 'French');

          await Waiter.pTryUntil('Language has changed', () => TinyAssertions.assertContent(editor, '<p><span lang="fr">Some content</span></p>'));

          await spec.pOpen(editor, 'Language');
          await pSelectItem(editor, spec.menuSelector, 'French');

          await Waiter.pTryUntil('Language has changed back', () => TinyAssertions.assertContent(editor, '<p>Some content</p>'));
        });
      });
    });

    context('Advanced settings', () => {
      beforeEach(() => {
        hook.editor().settings.content_langs = undefined;
      });

      Arr.each([ menuSpec, toolbarSpec ], (spec) => {
        it(`TINY-6149: ${spec.name} uses settings not available during initialisation to populate the UI`, async () => {
          const editor = hook.editor();

          editor.settings.content_langs = [{ title: 'English (AU)', code: 'en_AU' }];
          await spec.pOpen(editor, 'Language');
          await pAssertOptions(editor, spec.menuSelector, [ 'English (AU)' ], Optional.none());
          spec.close(editor, 'Language');

          editor.settings.content_langs = undefined;
          await spec.pOpen(editor, 'Language');
          await pAssertOptions(editor, spec.menuSelector, defaultLanguages, Optional.none());
          spec.close(editor, 'Language');
        });

        it(`TINY-6149: ${spec.name} applies custom language attributes`, async () => {
          const editor = hook.editor();
          editor.settings.content_langs = [{ title: 'Medical English (US)', code: 'en_US', customCode: 'en_US-medical' }];

          editor.setContent('<p>Hello world</p>');
          TinySelections.setSelection(editor, [ 0, 0 ], 0, [ 0, 0 ], 'Hello world'.length);

          await spec.pOpen(editor, 'Language');
          await pAssertOptions(editor, spec.menuSelector, [ 'Medical English (US)' ], Optional.none());
          await pSelectItem(editor, spec.menuSelector, 'Medical English (US)');

          TinyAssertions.assertContent(editor, '<p><span lang="en_US" data-mce-lang="en_US-medical">Hello world</span></p>');

          await spec.pOpen(editor, 'Language');
          await pAssertOptions(editor, spec.menuSelector, [ 'Medical English (US)' ], Optional.some('Medical English (US)'));
          await pSelectItem(editor, spec.menuSelector, 'Medical English (US)');

          TinyAssertions.assertContent(editor, '<p>Hello world</p>');
        });

        it(`TINY-6149: ${spec.name} differentiates languages with the same code but different custom codes`, async () => {
          const editor = hook.editor();
          editor.settings.content_langs = [
            { title: 'English', code: 'en' },
            { title: 'English (Variant)', code: 'en', customCode: 'en-variant' },
            { title: 'English (Other variant)', code: 'en', customCode: 'en-variant-2' }
          ];
          const variants = [ 'English', 'English (Variant)', 'English (Other variant)' ];

          editor.setContent('<p><span lang="en">Hello world</span></p>');
          TinySelections.setSelection(editor, [ 0, 0, 0 ], 0, [ 0, 0, 0 ], 'Hello world'.length);
          await spec.pOpen(editor, 'Language');

          await pAssertOptions(editor, spec.menuSelector, variants, Optional.some('English'));

          editor.formatter.apply('lang', { value: 'en', customValue: 'en-variant' });
          TinyAssertions.assertContent(editor, '<p><span lang="en" data-mce-lang="en-variant">Hello world</span></p>');
          await pAssertOptions(editor, spec.menuSelector, variants, Optional.some('English (Variant)'));

          editor.formatter.apply('lang', { value: 'en', customValue: 'en-variant-2' });
          TinyAssertions.assertContent(editor, '<p><span lang="en" data-mce-lang="en-variant-2">Hello world</span></p>');
          await pAssertOptions(editor, spec.menuSelector, variants, Optional.some('English (Other variant)'));

          spec.close(editor, 'Language');
        });
      });
    });
  });
});
