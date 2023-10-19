

import acm.program.ConsoleProgram;

public class Pr20 extends ConsoleProgram {
	
	public void run(){
		
		int d = readInt("Enter Number: ");
		int b = 0;
		
		for(int i = 0; i<d; i++){
		
			b = b + readInt();
			
		}
		
		println(b);
		
	}

}
