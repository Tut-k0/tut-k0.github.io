import { Github, Linkedin, Mail } from 'lucide-react';

const Social = () => {
    return (
        <div className="w-full max-w-4xl mx-auto py-6 flex justify-center space-x-6">
            <a href="https://github.com/Tut-k0" className="hover:text-green-300 transition-colors text-green-400">
                <Github className="w-6 h-6" />
            </a>
            <a href="https://www.linkedin.com/in/david-chandler-1577b0218/" className="hover:text-green-300 transition-colors text-green-400">
                <Linkedin className="w-6 h-6" />
            </a>
            <a href="mailto:tut_k0@protonmail.com" className="hover:text-green-300 transition-colors text-green-400">
                <Mail className="w-6 h-6" />
            </a>
        </div>
    );
};

export default Social;