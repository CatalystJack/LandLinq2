import Footer from "@/components/footer";
import { useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GripVertical, Type, Image as ImageIcon, MousePointer, Minus, Space, Plus, Save, Eye, Code, Trash2, Copy } from "lucide-react";
import { nanoid } from "nanoid";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface EmailComponent {
  id: string;
  type: 'text' | 'image' | 'button' | 'divider' | 'spacer';
  content?: string;
  props?: Record<string, any>;
}

const componentTypes = [
  { type: 'text', label: 'Text Block', icon: Type, defaultContent: 'Enter your text here...' },
  { type: 'image', label: 'Image', icon: ImageIcon, defaultContent: 'https://via.placeholder.com/600x200' },
  { type: 'button', label: 'Button', icon: MousePointer, defaultContent: 'Click Here' },
  { type: 'divider', label: 'Divider', icon: Minus, defaultContent: '' },
  { type: 'spacer', label: 'Spacer', icon: Space, defaultContent: '' },
];

function SortableComponent({ component, onEdit, onDelete, onDuplicate }: { component: EmailComponent; onEdit: (id: string, updates: Partial<EmailComponent>) => void; onDelete: (id: string) => void; onDuplicate: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: component.id });
  const [isEditing, setIsEditing] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const renderComponent = () => {
    const baseProps = component.props || {};
    
    switch (component.type) {
      case 'text':
        return (
          <div style={{ 
            color: baseProps.color || '#374151', 
            fontSize: baseProps.fontSize || '16px', 
            lineHeight: baseProps.lineHeight || '1.6',
            textAlign: baseProps.textAlign || 'left',
            fontWeight: baseProps.fontWeight || 'normal',
            padding: '10px 0'
          }}>
            {component.content}
          </div>
        );
      
      case 'image':
        return (
          <div style={{ textAlign: baseProps.align || 'center', padding: '10px 0' }}>
            <img 
              src={component.content || 'https://via.placeholder.com/600x200'} 
              alt={baseProps.alt || 'Email image'} 
              style={{ 
                maxWidth: baseProps.width || '100%', 
                height: 'auto',
                borderRadius: baseProps.borderRadius || '0px'
              }} 
            />
          </div>
        );
      
      case 'button':
        return (
          <div style={{ textAlign: baseProps.align || 'center', padding: '20px 0' }}>
            <a 
              href={baseProps.url || '#'} 
              style={{ 
                backgroundColor: baseProps.backgroundColor || '#4A90E2', 
                color: baseProps.color || 'white', 
                padding: baseProps.padding || '15px 30px', 
                textDecoration: 'none', 
                borderRadius: baseProps.borderRadius || '5px', 
                display: 'inline-block', 
                fontWeight: baseProps.fontWeight || 'bold',
                fontSize: baseProps.fontSize || '16px'
              }}
            >
              {component.content}
            </a>
          </div>
        );
      
      case 'divider':
        return (
          <div style={{ 
            borderBottom: `${baseProps.thickness || '1px'} ${baseProps.style || 'solid'} ${baseProps.color || '#e5e7eb'}`, 
            margin: `${baseProps.margin || '20px'} 0` 
          }}></div>
        );
      
      case 'spacer':
        return <div style={{ height: baseProps.height || '30px' }}></div>;
      
      default:
        return null;
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded" data-testid={`drag-${component.id}`}>
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>
      </div>
      
      <div className="border-2 border-dashed border-transparent group-hover:border-blue-300 rounded transition-colors relative">
        {renderComponent()}
        
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)} data-testid={`edit-${component.id}`}>
            Edit
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onDuplicate(component.id)} data-testid={`duplicate-${component.id}`}>
            <Copy className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(component.id)} data-testid={`delete-${component.id}`}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {component.type.charAt(0).toUpperCase() + component.type.slice(1)} Component</DialogTitle>
          </DialogHeader>
          
          <ComponentEditor 
            component={component} 
            onSave={(updates) => {
              onEdit(component.id, updates);
              setIsEditing(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}

function ComponentEditor({ component, onSave }: { component: EmailComponent; onSave: (updates: Partial<EmailComponent>) => void }) {
  const [content, setContent] = useState(component.content || '');
  const [props, setProps] = useState(component.props || {});

  const updateProp = (key: string, value: any) => {
    setProps(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave({ content, props });
  };

  return (
    <div className="space-y-4">
      {component.type === 'text' && (
        <>
          <div>
            <Label>Text Content</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} data-testid="input-text-content" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Font Size</Label>
              <Input value={props.fontSize || '16px'} onChange={(e) => updateProp('fontSize', e.target.value)} placeholder="16px" data-testid="input-font-size" />
            </div>
            <div>
              <Label>Color</Label>
              <Input value={props.color || '#374151'} onChange={(e) => updateProp('color', e.target.value)} placeholder="#374151" data-testid="input-color" />
            </div>
            <div>
              <Label>Text Align</Label>
              <select className="w-full border rounded p-2" value={props.textAlign || 'left'} onChange={(e) => updateProp('textAlign', e.target.value)} data-testid="select-text-align">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div>
              <Label>Font Weight</Label>
              <select className="w-full border rounded p-2" value={props.fontWeight || 'normal'} onChange={(e) => updateProp('fontWeight', e.target.value)} data-testid="select-font-weight">
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="600">Semi-Bold</option>
              </select>
            </div>
          </div>
        </>
      )}

      {component.type === 'image' && (
        <>
          <div>
            <Label>Image URL</Label>
            <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="https://..." data-testid="input-image-url" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Alt Text</Label>
              <Input value={props.alt || ''} onChange={(e) => updateProp('alt', e.target.value)} placeholder="Image description" data-testid="input-image-alt" />
            </div>
            <div>
              <Label>Width</Label>
              <Input value={props.width || '100%'} onChange={(e) => updateProp('width', e.target.value)} placeholder="100%" data-testid="input-image-width" />
            </div>
            <div>
              <Label>Alignment</Label>
              <select className="w-full border rounded p-2" value={props.align || 'center'} onChange={(e) => updateProp('align', e.target.value)} data-testid="select-image-align">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div>
              <Label>Border Radius</Label>
              <Input value={props.borderRadius || '0px'} onChange={(e) => updateProp('borderRadius', e.target.value)} placeholder="0px" data-testid="input-image-border-radius" />
            </div>
          </div>
        </>
      )}

      {component.type === 'button' && (
        <>
          <div>
            <Label>Button Text</Label>
            <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Click Here" data-testid="input-button-text" />
          </div>
          <div>
            <Label>Link URL</Label>
            <Input value={props.url || '#'} onChange={(e) => updateProp('url', e.target.value)} placeholder="https://..." data-testid="input-button-url" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Background Color</Label>
              <Input value={props.backgroundColor || '#4A90E2'} onChange={(e) => updateProp('backgroundColor', e.target.value)} placeholder="#4A90E2" data-testid="input-button-bg-color" />
            </div>
            <div>
              <Label>Text Color</Label>
              <Input value={props.color || 'white'} onChange={(e) => updateProp('color', e.target.value)} placeholder="white" data-testid="input-button-text-color" />
            </div>
            <div>
              <Label>Padding</Label>
              <Input value={props.padding || '15px 30px'} onChange={(e) => updateProp('padding', e.target.value)} placeholder="15px 30px" data-testid="input-button-padding" />
            </div>
            <div>
              <Label>Border Radius</Label>
              <Input value={props.borderRadius || '5px'} onChange={(e) => updateProp('borderRadius', e.target.value)} placeholder="5px" data-testid="input-button-border-radius" />
            </div>
          </div>
        </>
      )}

      {component.type === 'divider' && (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Color</Label>
            <Input value={props.color || '#e5e7eb'} onChange={(e) => updateProp('color', e.target.value)} placeholder="#e5e7eb" data-testid="input-divider-color" />
          </div>
          <div>
            <Label>Thickness</Label>
            <Input value={props.thickness || '1px'} onChange={(e) => updateProp('thickness', e.target.value)} placeholder="1px" data-testid="input-divider-thickness" />
          </div>
          <div>
            <Label>Style</Label>
            <select className="w-full border rounded p-2" value={props.style || 'solid'} onChange={(e) => updateProp('style', e.target.value)} data-testid="select-divider-style">
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
        </div>
      )}

      {component.type === 'spacer' && (
        <div>
          <Label>Height</Label>
          <Input value={props.height || '30px'} onChange={(e) => updateProp('height', e.target.value)} placeholder="30px" data-testid="input-spacer-height" />
        </div>
      )}

      <Button onClick={handleSave} className="w-full" data-testid="button-save-component">Save Changes</Button>
    </div>
  );
}

export default function EmailBuilder() {
  const [components, setComponents] = useState<EmailComponent[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [subject, setSubject] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showHtml, setShowHtml] = useState(false);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const addComponent = (type: string) => {
    const componentType = componentTypes.find(c => c.type === type);
    if (!componentType) return;

    const newComponent: EmailComponent = {
      id: nanoid(),
      type: type as any,
      content: componentType.defaultContent,
      props: {}
    };

    setComponents([...components, newComponent]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setComponents((items) => {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const editComponent = (id: string, updates: Partial<EmailComponent>) => {
    setComponents(components.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteComponent = (id: string) => {
    setComponents(components.filter(c => c.id !== id));
  };

  const duplicateComponent = (id: string) => {
    const component = components.find(c => c.id === id);
    if (!component) return;

    const newComponent = { ...component, id: nanoid() };
    const index = components.findIndex(c => c.id === id);
    const newComponents = [...components];
    newComponents.splice(index + 1, 0, newComponent);
    setComponents(newComponents);
  };

  const generateHtml = () => {
    let html = `<div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">`;
    
    // Add logo header
    html += `
      <div style="text-align: center; background-color: #ffffff; padding: 20px; margin-bottom: 0; border-radius: 8px 8px 0 0;">
        <img src="{{logoUrl}}" alt="{{companyName}}" style="max-height: 100px; width: auto; display: block; margin-left: auto; margin-right: auto;" />
      </div>
      <div style="border-bottom: 1px solid #4A90E2; margin-bottom: 30px;"></div>
      <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    `;

    components.forEach(component => {
      const props = component.props || {};
      
      switch (component.type) {
        case 'text':
          html += `<div style="color: ${props.color || '#374151'}; font-size: ${props.fontSize || '16px'}; line-height: ${props.lineHeight || '1.6'}; text-align: ${props.textAlign || 'left'}; font-weight: ${props.fontWeight || 'normal'}; padding: 10px 0;">${component.content}</div>`;
          break;
        
        case 'image':
          html += `<div style="text-align: ${props.align || 'center'}; padding: 10px 0;"><img src="${component.content}" alt="${props.alt || 'Email image'}" style="max-width: ${props.width || '100%'}; height: auto; border-radius: ${props.borderRadius || '0px'};" /></div>`;
          break;
        
        case 'button':
          html += `<div style="text-align: ${props.align || 'center'}; padding: 20px 0;"><a href="${props.url || '#'}" style="background-color: ${props.backgroundColor || '#4A90E2'}; color: ${props.color || 'white'}; padding: ${props.padding || '15px 30px'}; text-decoration: none; border-radius: ${props.borderRadius || '5px'}; display: inline-block; font-weight: ${props.fontWeight || 'bold'}; font-size: ${props.fontSize || '16px'};">${component.content}</a></div>`;
          break;
        
        case 'divider':
          html += `<div style="border-bottom: ${props.thickness || '1px'} ${props.style || 'solid'} ${props.color || '#e5e7eb'}; margin: ${props.margin || '20px'} 0;"></div>`;
          break;
        
        case 'spacer':
          html += `<div style="height: ${props.height || '30px'};"></div>`;
          break;
      }
    });

    html += `
      </div>
      <div style="text-align: center; margin-top: 30px; padding: 20px; font-size: 13px; color: #6b7280; line-height: 1.6;">
        <p style="margin: 0 0 8px 0;">© 2025 {{companyName}}</p>
        <p style="margin: 0 0 8px 0;">
          <a href="mailto:{{contactEmail}}" style="color: #d4af37; text-decoration: none;">{{contactEmail}}</a> | 
          <a href="tel:{{contactPhone}}" style="color: #d4af37; text-decoration: none;">{{contactPhone}}</a>
        </p>
        <p style="margin: 0;">
          <a href="{{websiteUrl}}" style="color: #d4af37; text-decoration: none;">{{websiteUrl}}</a>
        </p>
      </div>
    </div>`;

    return html;
  };

  const saveTemplate = () => {
    if (!templateName || !subject) {
      toast({
        title: "Missing Information",
        description: "Please provide both template name and subject line.",
        variant: "destructive"
      });
      return;
    }

    const html = generateHtml();
    console.log('Template saved:', { name: templateName, subject, html });
    
    toast({
      title: "Template Saved",
      description: `"${templateName}" has been saved successfully.`
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Email Template Builder</h1>
          <p className="text-gray-600 mt-2">Drag and drop components to build your email template</p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Component Palette */}
          <div className="col-span-3">
            <Card className="p-4">
              <h2 className="font-semibold text-lg mb-4">Components</h2>
              <div className="space-y-2">
                {componentTypes.map((comp) => (
                  <Button
                    key={comp.type}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => addComponent(comp.type)}
                    data-testid={`add-${comp.type}`}
                  >
                    <comp.icon className="h-4 w-4 mr-2" />
                    {comp.label}
                  </Button>
                ))}
              </div>
            </Card>
          </div>

          {/* Canvas */}
          <div className="col-span-6">
            <Card className="p-6 min-h-[600px]">
              <div className="mb-6 space-y-3">
                <div>
                  <Label>Template Name</Label>
                  <Input 
                    value={templateName} 
                    onChange={(e) => setTemplateName(e.target.value)} 
                    placeholder="e.g., Welcome Email" 
                    data-testid="input-template-name"
                  />
                </div>
                <div>
                  <Label>Subject Line</Label>
                  <Input 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                    placeholder="e.g., Welcome to {{companyName}}!" 
                    data-testid="input-subject"
                  />
                </div>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 bg-white min-h-[400px]">
                {components.length === 0 ? (
                  <div className="text-center text-gray-400 py-20">
                    <p>Drag components here to start building your email</p>
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={components.map(c => c.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2 pl-8">
                        {components.map((component) => (
                          <SortableComponent
                            key={component.id}
                            component={component}
                            onEdit={editComponent}
                            onDelete={deleteComponent}
                            onDuplicate={duplicateComponent}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </Card>
          </div>

          {/* Actions */}
          <div className="col-span-3">
            <Card className="p-4">
              <h2 className="font-semibold text-lg mb-4">Actions</h2>
              <div className="space-y-2">
                <Dialog open={showPreview} onOpenChange={setShowPreview}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full" data-testid="button-preview">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Email Preview</DialogTitle>
                    </DialogHeader>
                    <div dangerouslySetInnerHTML={{ __html: generateHtml() }} />
                  </DialogContent>
                </Dialog>

                <Dialog open={showHtml} onOpenChange={setShowHtml}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full" data-testid="button-view-html">
                      <Code className="h-4 w-4 mr-2" />
                      View HTML
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>HTML Code</DialogTitle>
                    </DialogHeader>
                    <Textarea value={generateHtml()} readOnly rows={20} className="font-mono text-xs" />
                  </DialogContent>
                </Dialog>

                <Button className="w-full" onClick={saveTemplate} data-testid="button-save-template">
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
