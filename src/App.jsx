import Terminal from './components/Terminal'
import NormalMode from './components/Normal';
import Social from './components/Socials';

function App() {
    return (
        <div className="bg-gray-900 min-h-screen">
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col gap-6">
                    <Terminal />
                    <NormalMode />
                    <Social />
                </div>
            </div>
        </div>
    );
}

export default App;