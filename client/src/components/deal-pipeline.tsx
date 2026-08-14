import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign,
  Users,
  Calendar,
  ArrowRight,
  Timer,
  Target,
  Filter,
  BarChart3,
  Eye,
  Edit,
  MessageSquare,
  Circle,
  Triangle,
  X
} from 'lucide-react';

interface Deal {
  id: string;
  address: string;
  askingPrice: string;
  brokerId: string;
  status: string;
  classification: 'red' | 'yellow' | 'green';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  pipelineStage: number;
  timeInCurrentStage: number;
  totalPipelineTime: number;
  estimatedCloseDate: string;
  statusUpdatedAt: string;
  stageHistory: Array<{
    stage: number;
    status: string;
    timestamp: string;
    duration: number;
    updatedBy: string;
  }>;
  broker: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

interface PipelineStage {
  id: number;
  name: string;
  description: string;
  averageTime: number; // in hours
  color: string;
  icon: React.ReactNode;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 1,
    name: 'Initial Review',
    description: 'Deal submission received and initial screening',
    averageTime: 4,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Eye className="w-4 h-4" />
  },
  {
    id: 2,
    name: 'Analysis',
    description: 'Detailed financial and market analysis',
    averageTime: 24,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: <BarChart3 className="w-4 h-4" />
  },
  {
    id: 3,
    name: 'Due Diligence',
    description: 'Legal, environmental, and technical review',
    averageTime: 72,
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: <AlertTriangle className="w-4 h-4" />
  },
  {
    id: 4,
    name: 'Final Review',
    description: 'Executive review and approval decision',
    averageTime: 8,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: <Target className="w-4 h-4" />
  },
  {
    id: 5,
    name: 'Negotiation',
    description: 'Contract terms and price negotiation',
    averageTime: 48,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    icon: <MessageSquare className="w-4 h-4" />
  },
  {
    id: 6,
    name: 'Contract',
    description: 'Legal documentation and contract execution',
    averageTime: 120,
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    icon: <Edit className="w-4 h-4" />
  },
  {
    id: 7,
    name: 'Closing',
    description: 'Final steps and deal completion',
    averageTime: 168,
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle className="w-4 h-4" />
  }
];

export function DealPipeline() {
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterClassification, setFilterClassification] = useState<string>('all');
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch deals with pipeline data
  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['/api/deals/pipeline'],
    staleTime: 30000, // 30 seconds
  });

  // Update deal stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ dealId, newStage, notes }: { dealId: string; newStage: number; notes?: string }) => {
      return await apiRequest('PUT', `/api/deals/${dealId}/stage`, { 
        pipelineStage: newStage,
        notes 
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals/pipeline'] });
      toast({
        title: 'Stage Updated',
        description: `Deal moved to ${PIPELINE_STAGES.find(s => s.id === variables.newStage)?.name}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update deal priority mutation
  const updatePriorityMutation = useMutation({
    mutationFn: async ({ dealId, priority }: { dealId: string; priority: string }) => {
      return await apiRequest('PUT', `/api/deals/${dealId}/priority`, { priority });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals/pipeline'] });
      toast({
        title: 'Priority Updated',
        description: 'Deal priority has been changed',
      });
    },
  });

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'green': return 'bg-green-100 text-green-800 border-green-200';
      case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'red': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getClassificationIcon = (classification: string) => {
    switch (classification) {
      case 'green': return <CheckCircle className="w-4 h-4 sm:w-3 sm:h-3" />;
      case 'yellow': return <AlertTriangle className="w-4 h-4 sm:w-3 sm:h-3" />;
      case 'red': return <X className="w-4 h-4 sm:w-3 sm:h-3" />;
      default: return <Circle className="w-4 h-4 sm:w-3 sm:h-3" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-amber-500 text-white';
      case 'medium': return 'bg-blue-500 text-white';
      case 'low': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatTimeInStage = (hours: number) => {
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  };

  const getDealsByStage = (stageId: number) => {
    let filteredDeals = deals.filter((deal: Deal) => deal.pipelineStage === stageId);
    
    if (filterPriority !== 'all') {
      filteredDeals = filteredDeals.filter((deal: Deal) => deal.priority === filterPriority);
    }
    
    if (filterClassification !== 'all') {
      filteredDeals = filteredDeals.filter((deal: Deal) => deal.classification === filterClassification);
    }
    
    return filteredDeals;
  };

  const getStageStats = () => {
    return PIPELINE_STAGES.map(stage => {
      const stageDeals = getDealsByStage(stage.id);
      const totalValue = stageDeals.reduce((sum: number, deal: Deal) => {
        return sum + (parseFloat(deal.askingPrice) || 0);
      }, 0);
      const overdue = stageDeals.filter((deal: Deal) => 
        deal.timeInCurrentStage > stage.averageTime * 1.5
      ).length;
      
      return {
        ...stage,
        count: stageDeals.length,
        value: totalValue,
        overdue
      };
    });
  };

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStage: number) => {
    e.preventDefault();
    if (draggedDeal && draggedDeal.pipelineStage !== targetStage) {
      updateStageMutation.mutate({
        dealId: draggedDeal.id,
        newStage: targetStage,
        notes: `Moved from ${PIPELINE_STAGES.find(s => s.id === draggedDeal.pipelineStage)?.name} to ${PIPELINE_STAGES.find(s => s.id === targetStage)?.name}`
      });
    }
    setDraggedDeal(null);
  };

  const stageStats = getStageStats();
  const totalDeals = deals.length;
  const totalValue = deals.reduce((sum: number, deal: Deal) => sum + (parseFloat(deal.askingPrice) || 0), 0);
  const averageDealTime = deals.length > 0 ? deals.reduce((sum: number, deal: Deal) => sum + deal.totalPipelineTime, 0) / deals.length : 0;

  return (
    <div className="space-y-6" data-testid="deal-pipeline">
      {/* Pipeline Overview */}
      <Card className="border-catalyst-gray-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-catalyst-gold bg-opacity-10 flex items-center justify-center rounded-lg">
                <TrendingUp className="text-catalyst-gold" size={20} />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold text-catalyst-gray-900 tracking-tight">
                  <span className="allow-wrap">Deal Pipeline Overview</span>
                </CardTitle>
                <p className="text-sm text-catalyst-gray-500 mt-1">
                  <span className="allow-wrap">Track deal progress with visual pipeline management</span>
                </p>
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex items-center space-x-2">
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-3 py-1 border border-catalyst-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-catalyst-gold"
                data-testid="filter-priority"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              
              <select
                value={filterClassification}
                onChange={(e) => setFilterClassification(e.target.value)}
                className="px-3 py-1 border border-catalyst-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-catalyst-gold"
                data-testid="filter-classification"
              >
                <option value="all">All Classifications</option>
                <option value="green">Green</option>
                <option value="yellow">Yellow</option>
                <option value="red">Red</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-catalyst-gray-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="text-catalyst-gold" size={16} />
                <span className="text-sm font-medium text-catalyst-gray-700">
                  <span className="allow-wrap">Total Deals</span>
                </span>
              </div>
              <span className="text-2xl font-bold text-catalyst-gray-900" data-testid="total-deals">
                {totalDeals}
              </span>
            </div>
            
            <div className="bg-catalyst-gray-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="text-catalyst-gold" size={16} />
                <span className="text-sm font-medium text-catalyst-gray-700">
                  <span className="allow-wrap">Pipeline Value</span>
                </span>
              </div>
              <span className="text-2xl font-bold text-catalyst-gray-900" data-testid="pipeline-value">
                ${(totalValue / 1000000).toFixed(1)}M
              </span>
            </div>
            
            <div className="bg-catalyst-gray-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Timer className="text-catalyst-gold" size={16} />
                <span className="text-sm font-medium text-catalyst-gray-700">
                  <span className="allow-wrap">Avg. Deal Time</span>
                </span>
              </div>
              <span className="text-2xl font-bold text-catalyst-gray-900" data-testid="avg-deal-time">
                {formatTimeInStage(averageDealTime)}
              </span>
            </div>
          </div>
          
          {/* Pipeline Stages */}
          <div className="space-y-4">
            {stageStats.map((stage, index) => (
              <div key={stage.id} className="bg-white border border-catalyst-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border ${stage.color}`}>
                      {stage.icon}
                      <span className="font-medium text-sm">
                        <span className="allow-wrap">{stage.name}</span>
                      </span>
                    </div>
                    <span className="text-sm text-catalyst-gray-600">
                      <span className="allow-wrap">{stage.description}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="text-center">
                      <div className="font-bold text-catalyst-gray-900">{stage.count}</div>
                      <div className="text-catalyst-gray-500">deals</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-catalyst-gray-900">${(stage.value / 1000000).toFixed(1)}M</div>
                      <div className="text-catalyst-gray-500">value</div>
                    </div>
                    {stage.overdue > 0 && (
                      <div className="text-center">
                        <div className="font-bold text-red-600">{stage.overdue}</div>
                        <div className="text-red-500">overdue</div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Deal Cards */}
                <div 
                  className="min-h-[100px] border-2 border-dashed border-catalyst-gray-200 rounded-lg p-3 space-y-2"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.id)}
                  data-testid={`stage-${stage.id}-dropzone`}
                >
                  {getDealsByStage(stage.id).map((deal: Deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => handleDragStart(deal)}
                      className="bg-white border border-catalyst-gray-200 rounded-lg p-3 cursor-move hover:shadow-md transition-shadow duration-200"
                      data-testid={`deal-card-${deal.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-xs font-mono bg-catalyst-gold text-white px-2 py-1 rounded">
                              #{(deal as any).dealNumber || 'TBD'}
                            </span>
                            <h4 className="font-medium text-catalyst-gray-900 truncate">
                              <span className="allow-wrap">{deal.address}</span>
                            </h4>
                          </div>
                          <p className="text-sm text-catalyst-gray-600">
                            <span className="allow-wrap">{deal.broker.firstName} {deal.broker.lastName}</span>
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 ml-2">
                          <Badge className={getPriorityColor(deal.priority)} data-testid={`priority-${deal.priority}`}>
                            <span className="hidden sm:inline">{deal.priority.toUpperCase()}</span>
                            <span className="sm:hidden text-xs font-bold">
                              {deal.priority === 'urgent' ? '🔥' : 
                               deal.priority === 'high' ? '⚡' : 
                               deal.priority === 'medium' ? '📊' : '📋'}
                            </span>
                          </Badge>
                          <Badge className={getClassificationColor(deal.classification)} data-testid={`classification-${deal.classification}`}>
                            <span className="hidden sm:inline">{deal.classification.toUpperCase()}</span>
                            <span className="sm:hidden flex items-center">
                              {getClassificationIcon(deal.classification)}
                            </span>
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-3">
                          <span className="font-medium text-catalyst-gray-900">
                            ${parseFloat(deal.askingPrice).toLocaleString()}
                          </span>
                          <div className="flex items-center space-x-1 text-catalyst-gray-500">
                            <Clock size={12} />
                            <span>{formatTimeInStage(deal.timeInCurrentStage)}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <select
                            value={deal.priority}
                            onChange={(e) => updatePriorityMutation.mutate({ dealId: deal.id, priority: e.target.value })}
                            className="px-2 py-1 border border-catalyst-gray-300 rounded text-xs"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`priority-select-${deal.id}`}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-catalyst-gray-500 mb-1">
                          <span>Stage Progress</span>
                          <span>{Math.round((stage.id / 7) * 100)}% Complete</span>
                        </div>
                        <Progress 
                          value={(stage.id / 7) * 100} 
                          className="h-2"
                          data-testid={`progress-${deal.id}`}
                        />
                      </div>
                    </div>
                  ))}
                  
                  {getDealsByStage(stage.id).length === 0 && (
                    <div className="flex items-center justify-center h-20 text-catalyst-gray-400">
                      <span className="text-sm">
                        <span className="allow-wrap">No deals in this stage</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Stage Bottleneck Analysis */}
      <Card className="border-catalyst-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-catalyst-gray-900">
            <span className="allow-wrap">Bottleneck Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stageStats.map(stage => {
              const avgTime = stage.averageTime;
              const currentDeals = getDealsByStage(stage.id);
              const overdueCount = currentDeals.filter((deal: Deal) => 
                deal.timeInCurrentStage > avgTime * 1.5
              ).length;
              const bottleneckScore = overdueCount / Math.max(currentDeals.length, 1);
              
              return (
                <div key={stage.id} className="flex items-center justify-between p-3 bg-catalyst-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${stage.color}`}>
                      {stage.icon}
                    </div>
                    <div>
                      <h4 className="font-medium text-catalyst-gray-900">
                        <span className="allow-wrap">{stage.name}</span>
                      </h4>
                      <p className="text-sm text-catalyst-gray-600">
                        <span className="allow-wrap">Avg: {formatTimeInStage(avgTime)} | Current: {currentDeals.length} deals</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {overdueCount > 0 && (
                      <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                        {overdueCount} overdue
                      </Badge>
                    )}
                    <div className={`w-3 h-3 rounded-full ${
                      bottleneckScore > 0.3 ? 'bg-red-500' : 
                      bottleneckScore > 0.1 ? 'bg-yellow-500' : 'bg-green-500'
                    }`} data-testid={`bottleneck-indicator-${stage.id}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}