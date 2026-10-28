import Link from 'next/link';
import { FaInstagram, FaXTwitter, FaWhatsapp, FaFacebook, FaLinkedin } from 'react-icons/fa6';

export default function Footer() {
  const socialLinks = [
    { name: 'Instagram', icon: FaInstagram, url: 'https://www.instagram.com/railjee.in/', color: 'hover:text-pink-400' },
    { name: 'X', icon: FaXTwitter, url: 'https://x.com/railjee', color: 'hover:text-gray-300' },
    { name: 'WhatsApp', icon: FaWhatsapp, url: 'https://chat.whatsapp.com/FZitYAl9NDrEITsBRrUu5O', color: 'hover:text-green-400' },
    { name: 'Facebook', icon: FaFacebook, url: 'https://www.facebook.com/railjee.in', color: 'hover:text-blue-400' },
    // { name: 'LinkedIn', icon: FaLinkedin, url: 'https://linkedin.com', color: 'hover:text-blue-300' },
  ];

  return (
    <footer className="bg-stone-900 text-white py-10 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center space-x-2 mb-4 sm:mb-6">
              <Link href="/" className="flex items-center space-x-2 group">
                <img
                  src="/images/logo.png"
                  alt="RailJee Logo"
                  className="h-7 sm:h-10 w-auto transition-transform group-hover:scale-105"
                />
              </Link>
            </div>
            <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
              Your trusted platform for railway promotional exams. Helping railway professionals prepare with confidence.
            </p>
            
            {/* Social Media Links */}
            <div className="flex items-center space-x-4 mt-6">
              {socialLinks.map((social) => {
                const IconComponent = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-stone-400 transition-colors duration-200 ${social.color}`}
                    aria-label={social.name}
                    title={social.name}
                  >
                    <IconComponent className="h-5 w-5 sm:h-6 sm:w-6" />
                  </a>
                );
              })}
            </div>
          </div>
          
          {/* Departments */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider mb-3 sm:mb-6">Departments</h3>
            <ul className="space-y-2 sm:space-y-4 text-stone-400">
              <li><Link href="/departments" className="hover:text-white transition-colors text-xs sm:text-sm">All Departments</Link></li>
              <li><Link href="/departments/civil" className="hover:text-white transition-colors text-xs sm:text-sm">Civil</Link></li>
              <li><Link href="/departments/mechanical" className="hover:text-white transition-colors text-xs sm:text-sm">Mechanical</Link></li>
              <li><Link href="/departments/electrical" className="hover:text-white transition-colors text-xs sm:text-sm">Electrical</Link></li>
              <li><Link href="/departments/commercial" className="hover:text-white transition-colors text-xs sm:text-sm">Commercial</Link></li>
              <li><Link href="/departments/personnel" className="hover:text-white transition-colors text-xs sm:text-sm">Personnel</Link></li>
            </ul>
          </div>
          
          {/* Quick Links */}
          {/* <div>
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider mb-3 sm:mb-6">Quick Links</h3>
            <ul className="space-y-2 sm:space-y-4 text-stone-400">
              <li><Link href="/#exams" className="hover:text-white transition-colors text-xs sm:text-sm">Practice Tests</Link></li>
              <li><Link href="/stats" className="hover:text-white transition-colors text-xs sm:text-sm">Your Statistics</Link></li>
              <li><Link href="/#features" className="hover:text-white transition-colors text-xs sm:text-sm">Features</Link></li>
              <li><Link href="/#about" className="hover:text-white transition-colors text-xs sm:text-sm">About</Link></li>
            </ul>
          </div> */}
          
          {/* Company */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider mb-3 sm:mb-6">Company</h3>
            <ul className="space-y-2 sm:space-y-4 text-stone-400">
              <li><Link href="/about" className="hover:text-white transition-colors text-xs sm:text-sm">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors text-xs sm:text-sm">Contact Us</Link></li>
              <li><Link href="/privacy-policy" className="hover:text-white transition-colors text-xs sm:text-sm">Privacy Policy</Link></li>
              <li><Link href="/terms-of-service" className="hover:text-white transition-colors text-xs sm:text-sm">Terms of Service</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors text-xs sm:text-sm">Pricing</Link></li>
              <li><Link href="/refund" className="hover:text-white transition-colors text-xs sm:text-sm">Refund Policy</Link></li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="border-t border-stone-800 mt-8 sm:mt-10 lg:mt-12 pt-6 sm:pt-8 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
          <p className="text-stone-500 text-xs sm:text-sm">&copy; 2026 RailJee. All rights reserved.</p>
          <p className="text-stone-500 text-xs sm:text-sm">
            Made with ❤️ by{' '}
            <a 
              href="https://backendandbeyond.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-stone-400 hover:text-white transition-colors underline decoration-dotted"
            >
              Backend & Beyond
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
