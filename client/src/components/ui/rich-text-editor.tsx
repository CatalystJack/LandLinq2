import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { useEffect, useCallback, useState } from 'react';
import { Button } from './button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  Indent,
  Outdent,
  Undo,
  Redo,
  Link as LinkIcon,
  Unlink,
  ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  lineHeight?: string;
  onLineHeightChange?: (lineHeight: string) => void;
}

const LINE_HEIGHT_OPTIONS = [
  { value: '1.0', label: 'Single' },
  { value: '1.15', label: '1.15' },
  { value: '1.4', label: '1.4' },
  { value: '1.5', label: '1.5' },
  { value: '1.75', label: '1.75' },
  { value: '2.0', label: 'Double' },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing your email content...',
  className,
  minHeight = '200px',
  lineHeight = '1.4',
  onLineHeightChange,
}: RichTextEditorProps) {
  const [currentLineHeight, setCurrentLineHeight] = useState(lineHeight);
  
  const handleLineHeightChange = (newLineHeight: string) => {
    setCurrentLineHeight(newLineHeight);
    onLineHeightChange?.(newLineHeight);
  };
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
          HTMLAttributes: {
            style: 'margin-left: 0; padding-left: 20px;',
          },
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
          HTMLAttributes: {
            style: 'margin-left: 0; padding-left: 20px;',
          },
        },
        listItem: {
          HTMLAttributes: {
            style: 'margin-bottom: 4px;',
          },
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          style: 'color: #0078D4; text-decoration: underline;',
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
        style: `min-height: ${minHeight}; padding: 12px;`,
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  const MenuButton = useCallback(
    ({
      onClick,
      isActive,
      children,
      title,
    }: {
      onClick: () => void;
      isActive?: boolean;
      children: React.ReactNode;
      title: string;
    }) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClick}
        className={cn(
          'h-8 w-8 p-0',
          isActive && 'bg-muted text-primary'
        )}
        title={title}
      >
        {children}
      </Button>
    ),
    []
  );

  if (!editor) {
    return null;
  }

  return (
    <div className={cn('border rounded-md overflow-hidden bg-white', className)}>
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-gray-50">
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <MenuButton
          onClick={() => {
            if (editor.isActive('listItem')) {
              editor.chain().focus().sinkListItem('listItem').run();
            }
          }}
          title="Increase Indent"
        >
          <Indent className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          onClick={() => {
            if (editor.isActive('listItem')) {
              editor.chain().focus().liftListItem('listItem').run();
            }
          }}
          title="Decrease Indent"
        >
          <Outdent className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <MenuButton
          onClick={() => {
            const previousUrl = editor.getAttributes('link').href;
            const url = window.prompt('Enter URL:', previousUrl || 'https://');
            if (url === null) return;
            if (url === '') {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }}
          isActive={editor.isActive('link')}
          title="Add Link (Ctrl+K)"
        >
          <LinkIcon className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().unsetLink().run()}
          title="Remove Link"
        >
          <Unlink className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Line Height Control */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Line:</span>
          <Select value={currentLineHeight} onValueChange={handleLineHeightChange}>
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue placeholder="1.4" />
            </SelectTrigger>
            <SelectContent>
              {LINE_HEIGHT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto text-xs text-gray-500">
          Use toolbar or keyboard shortcuts
        </div>
      </div>

      <EditorContent editor={editor} />

      <style>{`
        .ProseMirror {
          min-height: ${minHeight};
          padding: 12px;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #adb5bd;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 24px;
          margin: 8px 0;
        }
        .ProseMirror li {
          margin-bottom: 2px;
          line-height: ${currentLineHeight};
        }
        .ProseMirror li > ul,
        .ProseMirror li > ol {
          margin-left: 16px;
          margin-top: 4px;
          margin-bottom: 4px;
        }
        .ProseMirror strong {
          font-weight: 700;
        }
        .ProseMirror em {
          font-style: italic;
        }
        .ProseMirror u {
          text-decoration: underline;
        }
        .ProseMirror p {
          margin: 0 0 4px 0;
          line-height: ${currentLineHeight};
        }
        .ProseMirror a {
          color: #0078D4;
          text-decoration: underline;
          cursor: pointer;
        }
        .ProseMirror a:hover {
          color: #005a9e;
        }
      `}</style>
    </div>
  );
}
