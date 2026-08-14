// Graduated Commission Structure - Climbing in 0.1% increments
// All percentages are in ADDITION to standard commission
export interface CommissionTier {
  dealNumber: number;
  atRezoningRate: number; // Base: +1% (in addition to standard)
  atClosingRate: number;  // Base: +1% (in addition to standard)
  gpPromoteRate: number;  // Base: 2.0% GP Promote
}

export class GraduatedCommissionSystem {
  private static readonly BASE_REZONING_RATE = 1.0;  // +1% at rezoning
  private static readonly BASE_CLOSING_RATE = 1.0;   // +1% at closing  
  private static readonly BASE_GP_PROMOTE_RATE = 2.0; // 2.0% GP Promote
  private static readonly INCREMENT = 0.1;

  /**
   * Calculate commission rates for a broker based on their deal count
   * Climbs in 0.1% increments starting from base rates
   */
  static calculateCommissionTier(dealCount: number): CommissionTier {
    const increment = Math.floor(dealCount / 5) * this.INCREMENT; // Every 5 deals = +0.1%
    
    return {
      dealNumber: dealCount + 1,
      atRezoningRate: this.BASE_REZONING_RATE + increment,     // +1% + increments
      atClosingRate: this.BASE_CLOSING_RATE + increment,       // +1% + increments
      gpPromoteRate: this.BASE_GP_PROMOTE_RATE + increment,    // 2.0% + increments
    };
  }

  /**
   * Get all commission tiers up to a certain deal count
   */
  static getCommissionSchedule(maxDeals: number = 50): CommissionTier[] {
    const schedule: CommissionTier[] = [];
    
    for (let i = 0; i < maxDeals; i++) {
      schedule.push(this.calculateCommissionTier(i));
    }
    
    return schedule;
  }

  /**
   * Calculate commission earning for a specific deal
   */
  static calculateCommissionEarning(
    dealValue: number,
    dealStage: 'rezoning' | 'closing' | 'gp_promote',
    brokerDealCount: number
  ): number {
    const tier = this.calculateCommissionTier(brokerDealCount);
    
    let rate: number;
    switch (dealStage) {
      case 'rezoning':
        rate = tier.atRezoningRate;
        break;
      case 'closing':
        rate = tier.atClosingRate;
        break;
      case 'gp_promote':
        rate = tier.gpPromoteRate;
        break;
      default:
        rate = 0;
    }
    
    return dealValue * (rate / 100);
  }

  /**
   * Get formatted commission display string
   */
  static formatCommissionRate(rate: number): string {
    return `${rate.toFixed(1)}%`;
  }

  /**
   * Get broker's current commission level description
   */
  static getCommissionLevelDescription(dealCount: number): string {
    const tier = this.calculateCommissionTier(dealCount);
    const nextTier = this.calculateCommissionTier(dealCount + 5);
    
    return `Current: +${this.formatCommissionRate(tier.atRezoningRate)} rezoning, +${this.formatCommissionRate(tier.atClosingRate)} closing, ${this.formatCommissionRate(tier.gpPromoteRate)} GP Promote | Next tier at ${dealCount + 5} deals`;
  }

  /**
   * Calculate progress to next commission tier
   */
  static getProgressToNextTier(dealCount: number): {
    current: CommissionTier;
    next: CommissionTier;
    dealsToNext: number;
    progressPercent: number;
  } {
    const current = this.calculateCommissionTier(dealCount);
    const nextTierDealCount = Math.ceil((dealCount + 1) / 5) * 5;
    const next = this.calculateCommissionTier(nextTierDealCount);
    const dealsToNext = nextTierDealCount - dealCount;
    const progressPercent = ((dealCount % 5) / 5) * 100;

    return {
      current,
      next,
      dealsToNext,
      progressPercent
    };
  }
}

// Export for use in calculations
export default GraduatedCommissionSystem;