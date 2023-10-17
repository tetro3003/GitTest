

import acm.program.ConsoleProgram;

public class Problem16plus1 extends ConsoleProgram {
	
	public void run(){
		
		double a = readDouble("Enter num a: ");
		double b = readDouble("Enter num b: ");
		double c = readDouble("Enter num c: ");
		
		double harm = 1/(1/a+1/b+1/c);
		println(harm);
		
	}

}
