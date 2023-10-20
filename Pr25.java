import acm.program.ConsoleProgram;

public class Pr25 extends ConsoleProgram {
	
	public void run(){
		
		int num1 = readInt("Enter Number N1: ");
		int num2 = readInt("Enter Number N2: ");
		
		usj(num1, num2);
		
	}
	
	private void usj(int a, int b){
		
		int c = 1;
		
		while(b%(a*c)!=0){
			
			c++;
			if(b%(a*c)==0) {
				int d = a*c;
				println(d);
			}
		}
		
	}

}
