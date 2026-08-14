export default function EmailPreview() {
  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ textAlign: 'center', color: 'white', marginBottom: '50px' }}>
        <h1 style={{ fontSize: '36px', marginBottom: '10px' }}>📧 Email Templates Gallery</h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>Updated with clean spacing & light blue separator line</p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
        gap: '30px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        
        {/* Deal Submitted Template */}
        <TemplateCard 
          name="Deal Submission Confirmation" 
          badge="Confirmation" 
          badgeColor="#d1fae5"
          badgeTextColor="#065f46"
        >
          <EmailTemplate>
            <EmailHeader />
            <EmailContent>
              <p style={textStyle}>Hi Jack Berg,</p>
              <p style={textStyle}>Your LandLinq™ property submission has been received!</p>
              <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', margin: '20px 0' }}>
                <p style={{ margin: '5px 0', color: '#374151' }}><strong>Property:</strong> 1600 Camden Road, Charlotte, NC 28203</p>
                <p style={{ margin: '5px 0', color: '#374151' }}><strong>Status:</strong> Under Review</p>
              </div>
              <p style={textStyle}>Someone from the Catalyst Acquisition Team will respond within 24 hours.</p>
            </EmailContent>
          </EmailTemplate>
        </TemplateCard>

        {/* Deal Rejected Template */}
        <TemplateCard 
          name="Deal Rejection Notice" 
          badge="Rejection" 
          badgeColor="#fee2e2"
          badgeTextColor="#991b1b"
        >
          <EmailTemplate>
            <EmailHeader />
            <EmailContent>
              <p style={textStyle}>Dear Jack Berg,</p>
              <p style={textStyle}>Thank you for submitting <strong>1600 Camden Road, Charlotte, NC</strong> for our consideration. After thorough review, this property doesn't align with our current acquisition criteria.</p>
              <div style={{ backgroundColor: '#f3f4f6', padding: '20px', margin: '0 0 25px 0', borderRadius: '4px' }}>
                <p style={{ color: '#374151', margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>Review Summary:</p>
                <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>
                  Property: 1600 Camden Road<br />
                  Deal ID: #208<br />
                  Review Date: October 13, 2025
                </p>
              </div>
              <p style={textStyle}>Please keep us in mind for future opportunities! We value our relationship and want to work together on the right deal.</p>
            </EmailContent>
          </EmailTemplate>
        </TemplateCard>

        {/* High Priority Template */}
        <TemplateCard 
          name="High Priority Deal" 
          badge="Pursuing" 
          badgeColor="#d1fae5"
          badgeTextColor="#065f46"
        >
          <EmailTemplate>
            <EmailHeader />
            <EmailContent>
              <p style={textStyle}>Hi Jack Berg,</p>
              <p style={textStyle}><strong>FANTASTIC NEWS!</strong> We are very excited about your submission!</p>
              <div style={{ backgroundColor: '#d1fae5', borderLeft: '4px solid #10b981', padding: '20px', margin: '0 0 25px 0', borderRadius: '4px' }}>
                <p style={{ color: '#065f46', margin: 0, fontSize: '14px', lineHeight: 1.8 }}>
                  <strong>Property:</strong> 1600 Camden Road<br />
                  <strong>Deal ID:</strong> #208<br />
                  <strong>Status:</strong> HIGH PRIORITY - Excellent Fit!
                </p>
              </div>
              <p style={textStyle}><strong>Why We Love This Deal:</strong><br />This property hits all the marks for our acquisition criteria - great location, proper sizing, and strong market fundamentals.</p>
              <p style={textStyle}>Austin Blondell will be reaching out within 24 hours!</p>
            </EmailContent>
          </EmailTemplate>
        </TemplateCard>

        {/* Welcome Template */}
        <TemplateCard 
          name="Broker Welcome" 
          badge="Onboarding" 
          badgeColor="#dbeafe"
          badgeTextColor="#1e40af"
        >
          <EmailTemplate>
            <EmailHeader />
            <EmailContent>
              <p style={textStyle}>Dear Jack Berg,</p>
              <p style={textStyle}>Welcome to LandLinq! We're excited to have you join our land acquisition network. Here's how to get started:</p>
              <div style={{ backgroundColor: '#fef3c7', borderLeft: '4px solid #d4af37', padding: '20px', margin: '0 0 25px 0', borderRadius: '4px' }}>
                <p style={{ color: '#92400e', margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>Submission Methods:</p>
                <p style={{ color: '#92400e', margin: 0, fontSize: '14px', lineHeight: 1.8 }}>
                  Email: catalyst@landlinq.ai<br />
                  SMS: (704) 610-1549<br />
                  Web: landlinq.ai/submit-deal
                </p>
              </div>
              <p style={textStyle}>We respond within 2 hours and provide decisions in 24-48 hours.</p>
            </EmailContent>
          </EmailTemplate>
        </TemplateCard>

        {/* Info Request Template */}
        <TemplateCard 
          name="Information Request" 
          badge="Action Needed" 
          badgeColor="#fef3c7"
          badgeTextColor="#92400e"
        >
          <EmailTemplate>
            <EmailHeader />
            <EmailContent>
              <p style={textStyle}>Hi Jack Berg,</p>
              <p style={textStyle}>Our Acquisitions team is requesting additional information for <strong>1600 Camden Road</strong>:</p>
              <div style={{ backgroundColor: '#fef3c7', borderLeft: '4px solid #d4af37', padding: '20px', margin: '0 0 25px 0', borderRadius: '4px' }}>
                <p style={{ color: '#92400e', margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>Missing Information:</p>
                <p style={{ color: '#92400e', margin: 0, fontSize: '14px', lineHeight: 1.8 }}>
                  • Property size (acres)<br />
                  • Asking price
                </p>
              </div>
              <p style={textStyle}>Please reply with this info so we can continue our analysis and pursuit.</p>
            </EmailContent>
          </EmailTemplate>
        </TemplateCard>

        {/* Password Reset Template */}
        <TemplateCard 
          name="Password Reset" 
          badge="Security" 
          badgeColor="#dbeafe"
          badgeTextColor="#1e40af"
        >
          <EmailTemplate>
            <EmailHeader />
            <EmailContent>
              <p style={textStyle}>Hi jack@catalystcp.com,</p>
              <p style={textStyle}>You recently requested to reset your password for your LandLinq account.</p>
              <div style={{ textAlign: 'center', margin: '30px 0' }}>
                <a href="#" style={{ backgroundColor: '#4A90E2', color: 'white', padding: '15px 30px', textDecoration: 'none', borderRadius: '5px', display: 'inline-block', fontWeight: 'bold', fontSize: '16px' }}>Reset Your Password</a>
              </div>
              <div style={{ backgroundColor: '#dbeafe', border: '1px solid #93c5fd', padding: '15px', borderRadius: '5px', margin: '20px 0' }}>
                <p style={{ margin: 0, fontWeight: 'bold', color: '#1e40af' }}>Security tip:</p>
                <p style={{ margin: '5px 0 0 0', color: '#1e40af', fontSize: '14px' }}>This link expires in 1 hour for your security.</p>
              </div>
            </EmailContent>
          </EmailTemplate>
        </TemplateCard>

      </div>

      <div style={{ textAlign: 'center', margin: '50px 0', color: 'white' }}>
        <p style={{ fontSize: '14px', opacity: 0.9 }}>
          ✨ All templates updated with clean spacing & light blue (#4A90E2) separator line
        </p>
      </div>
    </div>
  );
}

// Helper Components
function TemplateCard({ name, badge, badgeColor, badgeTextColor, children }: any) {
  return (
    <div style={{ 
      background: 'white', 
      borderRadius: '16px', 
      padding: '20px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <span style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>{name}</span>
        <span style={{ 
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          background: badgeColor,
          color: badgeTextColor
        }}>{badge}</span>
      </div>
      <div style={{ 
        background: '#f9fafb',
        borderRadius: '8px',
        overflow: 'hidden',
        transform: 'scale(0.85)',
        transformOrigin: 'top center'
      }}>
        {children}
      </div>
    </div>
  );
}

function EmailTemplate({ children }: any) {
  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#f9fafb',
      padding: '20px'
    }}>
      {children}
      <div style={{ textAlign: 'center', marginTop: '30px', padding: '20px', fontSize: '13px', color: '#6b7280' }}>
        <p style={{ margin: 0 }}>© 2025 LandLinq</p>
      </div>
    </div>
  );
}

function EmailHeader() {
  return (
    <>
      <div style={{ 
        textAlign: 'center', 
        backgroundColor: '#ffffff', 
        padding: '20px 20px 5px 20px', 
        marginBottom: 0, 
        borderRadius: '8px 8px 0 0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <img 
          src="https://landlinq.ai/landlinq-logo.png" 
          alt="LandLinq" 
          style={{ maxHeight: '100px', width: 'auto', display: 'block', margin: 0 }} 
        />
      </div>
      <div style={{ borderBottom: '1px solid #4A90E2', marginBottom: '30px' }}></div>
    </>
  );
}

function EmailContent({ children }: any) {
  return (
    <div style={{ 
      backgroundColor: '#ffffff', 
      padding: '40px 30px', 
      borderRadius: '8px', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)' 
    }}>
      {children}
    </div>
  );
}

const textStyle = { 
  color: '#374151', 
  margin: '0 0 20px 0', 
  fontSize: '16px', 
  lineHeight: 1.6 
};
