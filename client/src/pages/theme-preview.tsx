import React from 'react';
import { CheckCircle, XCircle, Star, Users, TrendingUp, Calendar } from "lucide-react";

export default function ThemePreview() {
  return (
    <div style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      {/* Navigation Bar */}
      <nav style={{ backgroundColor: '#15265C', padding: '1rem 2rem' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <h1 style={{ color: '#F9FAFB', fontSize: '1.5rem', fontWeight: 'bold' }}>
              Your Brand
            </h1>
            <div className="hidden md:flex space-x-6">
              <a href="#" style={{ color: '#F9FAFB', textDecoration: 'none', opacity: 0.9 }} 
                 className="hover:text-blue-400">
                Home
              </a>
              <a href="#" style={{ color: '#F9FAFB', textDecoration: 'none', opacity: 0.9 }}
                 className="hover:text-blue-400">
                About
              </a>
              <a href="#" style={{ color: '#F9FAFB', textDecoration: 'none', opacity: 0.9 }}
                 className="hover:text-blue-400">
                Services
              </a>
              <a href="#" style={{ color: '#F9FAFB', textDecoration: 'none', opacity: 0.9 }}
                 className="hover:text-blue-400">
                Contact
              </a>
            </div>
          </div>
          <button 
            style={{ 
              backgroundColor: '#4891FA', 
              color: 'white', 
              padding: '0.5rem 1.5rem', 
              borderRadius: '0.375rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500'
            }}
            className="hover:bg-blue-600 transition-colors"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 style={{ 
            color: '#111827', 
            fontSize: '3rem', 
            fontWeight: 'bold', 
            marginBottom: '1.5rem',
            lineHeight: '1.1'
          }}>
            Beautiful Theme Preview
          </h1>
          <p style={{ 
            color: '#4B5563', 
            fontSize: '1.25rem', 
            marginBottom: '2rem',
            maxWidth: '600px',
            margin: '0 auto 2rem auto'
          }}>
            Experience our carefully crafted color palette in action. Clean, modern, and professional design that works across all your brand touchpoints.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              style={{ 
                backgroundColor: '#4891FA', 
                color: 'white', 
                padding: '0.75rem 2rem', 
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600'
              }}
              className="hover:bg-blue-600 transition-colors"
            >
              Primary Button
            </button>
            <button 
              style={{ 
                backgroundColor: 'transparent', 
                color: '#4891FA', 
                padding: '0.75rem 2rem', 
                borderRadius: '0.5rem',
                border: '2px solid #4891FA',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600'
              }}
              className="hover:bg-blue-500 hover:text-white transition-colors"
            >
              Secondary Button
            </button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section style={{ backgroundColor: '#F1F5F9', padding: '4rem 1.5rem' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div style={{ 
                backgroundColor: '#69C3A4', 
                color: 'white', 
                width: '3rem', 
                height: '3rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <Users size={24} />
              </div>
              <h3 style={{ color: '#111827', fontSize: '2rem', fontWeight: 'bold' }}>2.5K+</h3>
              <p style={{ color: '#4B5563' }}>Active Users</p>
            </div>
            <div className="text-center">
              <div style={{ 
                backgroundColor: '#69C3A4', 
                color: 'white', 
                width: '3rem', 
                height: '3rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <TrendingUp size={24} />
              </div>
              <h3 style={{ color: '#111827', fontSize: '2rem', fontWeight: 'bold' }}>98%</h3>
              <p style={{ color: '#4B5563' }}>Satisfaction Rate</p>
            </div>
            <div className="text-center">
              <div style={{ 
                backgroundColor: '#69C3A4', 
                color: 'white', 
                width: '3rem', 
                height: '3rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <Star size={24} />
              </div>
              <h3 style={{ color: '#111827', fontSize: '2rem', fontWeight: 'bold' }}>4.9</h3>
              <p style={{ color: '#4B5563' }}>Average Rating</p>
            </div>
            <div className="text-center">
              <div style={{ 
                backgroundColor: '#69C3A4', 
                color: 'white', 
                width: '3rem', 
                height: '3rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <Calendar size={24} />
              </div>
              <h3 style={{ color: '#111827', fontSize: '2rem', fontWeight: 'bold' }}>5+</h3>
              <p style={{ color: '#4B5563' }}>Years Experience</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 style={{ 
              color: '#1E3A8A', 
              fontSize: '2.5rem', 
              fontWeight: 'bold', 
              marginBottom: '1rem'
            }}>
              Key Features
            </h2>
            <p style={{ color: '#4B5563', fontSize: '1.125rem' }}>
              Discover what makes our platform stand out
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div style={{ 
              backgroundColor: 'white', 
              padding: '2rem', 
              borderRadius: '0.75rem',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ 
                  backgroundColor: '#69C3A4', 
                  color: 'white', 
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  New
                </span>
              </div>
              <h3 style={{ color: '#1E3A8A', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Advanced Analytics
              </h3>
              <p style={{ color: '#4B5563', lineHeight: '1.6' }}>
                Get detailed insights with our powerful analytics dashboard and real-time reporting features.
              </p>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              padding: '2rem', 
              borderRadius: '0.75rem',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ color: '#1E3A8A', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Secure Platform
              </h3>
              <p style={{ color: '#4B5563', lineHeight: '1.6', marginBottom: '1rem' }}>
                Enterprise-grade security with end-to-end encryption and compliance certifications.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34D399' }}>
                <CheckCircle size={16} />
                <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Verified Secure</span>
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              padding: '2rem', 
              borderRadius: '0.75rem',
              border: '1px solid #E5E7EB',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ color: '#1E3A8A', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                24/7 Support
              </h3>
              <p style={{ color: '#4B5563', lineHeight: '1.6', marginBottom: '1rem' }}>
                Our dedicated support team is available around the clock to help you succeed.
              </p>
              <a href="#" style={{ 
                color: '#4891FA', 
                textDecoration: 'none', 
                fontWeight: '500',
                fontSize: '0.875rem'
              }}
              className="hover:text-blue-600">
                Contact Support →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Status Messages */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div style={{ 
            backgroundColor: '#F0FDF4', 
            color: '#166534',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem',
            border: '1px solid #34D399',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <CheckCircle size={20} style={{ color: '#34D399' }} />
            <span>Success! Your changes have been saved.</span>
          </div>
          
          <div style={{ 
            backgroundColor: '#FEF2F2', 
            color: '#991B1B',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem',
            border: '1px solid #EF4444',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <XCircle size={20} style={{ color: '#EF4444' }} />
            <span>Error: Please check your input and try again.</span>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section style={{ backgroundColor: '#F1F5F9', padding: '4rem 1.5rem' }}>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 style={{ 
              color: '#1E3A8A', 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              marginBottom: '1rem'
            }}>
              Get in Touch
            </h2>
            <p style={{ color: '#4B5563' }}>
              Ready to get started? Send us a message and we'll get back to you.
            </p>
          </div>

          <div style={{ 
            backgroundColor: 'white', 
            padding: '2rem', 
            borderRadius: '0.75rem',
            border: '1px solid #E5E7EB'
          }}>
            <div className="space-y-4">
              <div>
                <label style={{ 
                  display: 'block', 
                  color: '#111827', 
                  fontWeight: '500', 
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem'
                }}>
                  Name
                </label>
                <input 
                  type="text" 
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    borderRadius: '0.375rem',
                    border: '1px solid #E5E7EB',
                    fontSize: '1rem'
                  }}
                  placeholder="Your name"
                  className="focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label style={{ 
                  display: 'block', 
                  color: '#111827', 
                  fontWeight: '500', 
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem'
                }}>
                  Email
                </label>
                <input 
                  type="email" 
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    borderRadius: '0.375rem',
                    border: '1px solid #E5E7EB',
                    fontSize: '1rem'
                  }}
                  placeholder="your@email.com"
                  className="focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label style={{ 
                  display: 'block', 
                  color: '#111827', 
                  fontWeight: '500', 
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem'
                }}>
                  Message
                </label>
                <textarea 
                  rows={4}
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    borderRadius: '0.375rem',
                    border: '1px solid #E5E7EB',
                    fontSize: '1rem',
                    resize: 'vertical'
                  }}
                  placeholder="Tell us about your project..."
                  className="focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button 
                style={{ 
                  width: '100%',
                  backgroundColor: '#4891FA', 
                  color: 'white', 
                  padding: '0.875rem', 
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
                className="hover:bg-blue-600 transition-colors"
              >
                Send Message
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: '#15265C', padding: '3rem 1.5rem 2rem' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 style={{ color: '#F9FAFB', fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                Your Brand
              </h3>
              <p style={{ color: '#F9FAFB', opacity: 0.8, lineHeight: '1.6' }}>
                Building beautiful experiences with thoughtful design and powerful technology.
              </p>
            </div>
            <div>
              <h4 style={{ color: '#F9FAFB', fontWeight: '600', marginBottom: '1rem' }}>
                Product
              </h4>
              <div className="space-y-2">
                <a href="#" style={{ 
                  color: '#F9FAFB', 
                  opacity: 0.8,
                  textDecoration: 'none', 
                  display: 'block',
                  fontSize: '0.875rem'
                }}
                className="hover:text-blue-400">
                  Features
                </a>
                <a href="#" style={{ 
                  color: '#F9FAFB', 
                  opacity: 0.8,
                  textDecoration: 'none', 
                  display: 'block',
                  fontSize: '0.875rem'
                }}
                className="hover:text-blue-400">
                  Pricing
                </a>
                <a href="#" style={{ 
                  color: '#F9FAFB', 
                  opacity: 0.8,
                  textDecoration: 'none', 
                  display: 'block',
                  fontSize: '0.875rem'
                }}
                className="hover:text-blue-400">
                  Documentation
                </a>
              </div>
            </div>
            <div>
              <h4 style={{ color: '#F9FAFB', fontWeight: '600', marginBottom: '1rem' }}>
                Company
              </h4>
              <div className="space-y-2">
                <a href="#" style={{ 
                  color: '#F9FAFB', 
                  opacity: 0.8,
                  textDecoration: 'none', 
                  display: 'block',
                  fontSize: '0.875rem'
                }}
                className="hover:text-blue-400">
                  About
                </a>
                <a href="#" style={{ 
                  color: '#F9FAFB', 
                  opacity: 0.8,
                  textDecoration: 'none', 
                  display: 'block',
                  fontSize: '0.875rem'
                }}
                className="hover:text-blue-400">
                  Blog
                </a>
                <a href="#" style={{ 
                  color: '#F9FAFB', 
                  opacity: 0.8,
                  textDecoration: 'none', 
                  display: 'block',
                  fontSize: '0.875rem'
                }}
                className="hover:text-blue-400">
                  Careers
                </a>
              </div>
            </div>
            <div>
              <h4 style={{ color: '#F9FAFB', fontWeight: '600', marginBottom: '1rem' }}>
                Support
              </h4>
              <div className="space-y-2">
                <a href="#" style={{ 
                  color: '#F9FAFB', 
                  opacity: 0.8,
                  textDecoration: 'none', 
                  display: 'block',
                  fontSize: '0.875rem'
                }}
                className="hover:text-blue-400">
                  Help Center
                </a>
                <a href="#" style={{ 
                  color: '#F9FAFB', 
                  opacity: 0.8,
                  textDecoration: 'none', 
                  display: 'block',
                  fontSize: '0.875rem'
                }}
                className="hover:text-blue-400">
                  Contact Us
                </a>
                <a href="#" style={{ 
                  color: '#F9FAFB', 
                  opacity: 0.8,
                  textDecoration: 'none', 
                  display: 'block',
                  fontSize: '0.875rem'
                }}
                className="hover:text-blue-400">
                  Status
                </a>
              </div>
            </div>
          </div>
          
          <div style={{ 
            borderTop: '1px solid rgba(249, 250, 251, 0.2)', 
            paddingTop: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <p style={{ color: '#F9FAFB', opacity: 0.6, fontSize: '0.875rem' }}>
              © 2024 Your Brand. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <a href="#" style={{ 
                color: '#F9FAFB', 
                opacity: 0.6,
                textDecoration: 'none',
                fontSize: '0.875rem'
              }}
              className="hover:text-blue-400">
                Privacy
              </a>
              <a href="#" style={{ 
                color: '#F9FAFB', 
                opacity: 0.6,
                textDecoration: 'none',
                fontSize: '0.875rem'
              }}
              className="hover:text-blue-400">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}